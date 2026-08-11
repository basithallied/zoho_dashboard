"""Anomaly detection.

Two families of rules run over the same scan: business-data exceptions and
software-usage exceptions. Every finding has to answer four questions — what
happened, why it matters, what it costs, and what to do next — and name an
owner, so rules return all of that or they do not fire.

Findings are keyed deterministically (`dedupe_key`), so re-scanning updates the
existing item instead of piling up duplicates, and anything a user has marked
as a false positive stays suppressed while it tunes the rule that raised it.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import Callable

from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from services import audit

SEVERITY_ORDER = {"high": 3, "medium": 2, "low": 1, "info": 0}
BUSINESS_HOURS = (7, 19)
SUPPRESSED_STATUSES = ("false_positive", "ignored")


@dataclass
class Finding:
    dedupe_key: str
    rule_code: str
    title: str
    module: str
    domain: str
    severity: str
    what_happened: str
    why_it_matters: str
    recommended_actions: list[str]
    financial_impact: float = 0.0
    impact_label: str = ""
    owner_email: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    entity_label: str | None = None
    facts: dict = field(default_factory=dict)
    source_refs: list[dict] = field(default_factory=list)


RULES: dict[str, Callable[[Session, models.AnomalyRule], list[Finding]]] = {}


def rule(code: str):
    def decorator(fn):
        RULES[code] = fn
        return fn
    return decorator


def _param(rule_row: models.AnomalyRule, name: str, default):
    return (rule_row.params or {}).get(name, default)


def _threshold(rule_row: models.AnomalyRule, name: str, default: float) -> float:
    """Rule thresholds are scaled by sensitivity, which false-positive marks raise."""
    return float(_param(rule_row, name, default)) * float(rule_row.sensitivity or 1.0)


def _escalate(base: str, impact: float, high_at: float, medium_at: float) -> str:
    if impact >= high_at:
        return "high"
    if impact >= medium_at:
        return "medium"
    return base


def _ref(entity_type: str, entity_id, label: str) -> dict:
    return {"entity_type": entity_type, "entity_id": str(entity_id), "label": label}


# ---------------------------------------------------------------------------
# Business-data rules
# ---------------------------------------------------------------------------

@rule("INVOICE_NOT_RAISED")
def _invoice_not_raised(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    grace_days = _threshold(rule_row, "grace_days", 2)
    cutoff = datetime.date.today() - datetime.timedelta(days=grace_days)
    findings = []

    milestones = (
        db.query(models.ProjectMilestone)
        .filter(
            models.ProjectMilestone.completion_percentage >= 100,
            models.ProjectMilestone.is_invoiced.is_(False),
            models.ProjectMilestone.actual_completion.isnot(None),
            models.ProjectMilestone.actual_completion <= cutoff,
        )
        .all()
    )
    for milestone in milestones:
        project = milestone.project
        delay = (datetime.date.today() - milestone.actual_completion).days
        findings.append(Finding(
            dedupe_key=f"INVOICE_NOT_RAISED:{milestone.source_id}",
            rule_code="INVOICE_NOT_RAISED",
            title="Invoice not raised for completed work",
            module="projects",
            domain="business",
            severity=_escalate("medium", milestone.value, 100_000, 25_000),
            what_happened=(
                f'The milestone "{milestone.name}" on {project.name if project else "an unknown project"} '
                f"is marked 100% complete, but no invoice has been created against it."
            ),
            why_it_matters=(
                "Revenue realisation is delayed and cash flow is impacted for as long as the "
                "completed work stays unbilled."
            ),
            financial_impact=float(milestone.value or 0.0),
            impact_label="Potential revenue delay",
            recommended_actions=[
                "Create the invoice for the completed milestone.",
                "Share the invoice with the client for approval.",
                "Follow up with the accounts team.",
            ],
            owner_email=None,
            entity_type="ProjectMilestone",
            entity_id=milestone.source_id,
            entity_label=f"{project.name if project else 'Project'} — {milestone.name}",
            facts={
                "project": project.name if project else None,
                "milestone": milestone.name,
                "planned_completion": str(milestone.planned_completion or ""),
                "actual_completion": str(milestone.actual_completion),
                "delay_days": delay,
                "contract_value": float(project.contract_value or 0.0) if project else None,
            },
            source_refs=[
                _ref("ProjectMilestone", milestone.source_id, milestone.name),
                *([_ref("Project", project.source_id, project.name)] if project else []),
            ],
        ))
    return findings


@rule("PROJECT_COST_OVERRUN")
def _project_cost_overrun(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    tolerance = _threshold(rule_row, "overrun_ratio", 0.10)
    findings = []
    projects = (
        db.query(models.Project).filter(models.Project.status == "in_progress").all()
    )
    for project in projects:
        budget = float(project.budget or 0.0)
        if budget <= 0:
            continue
        overrun = float(project.actual_cost or 0.0) - budget
        ratio = overrun / budget
        if ratio <= tolerance:
            continue
        findings.append(Finding(
            dedupe_key=f"PROJECT_COST_OVERRUN:{project.source_id}",
            rule_code="PROJECT_COST_OVERRUN",
            title="Project cost exceeds budget",
            module="projects",
            domain="business",
            severity=_escalate("medium", overrun, 250_000, 50_000),
            what_happened=(
                f"Actual cost on {project.name} is {ratio * 100:.0f}% higher than the approved budget."
            ),
            why_it_matters=(
                "Margin on the contract erodes and the overrun has to be funded from elsewhere "
                "unless a variation is agreed with the client."
            ),
            financial_impact=overrun,
            impact_label="Budget variance",
            recommended_actions=[
                "Review committed costs against the approved budget with the project manager.",
                "Raise a variation order if the scope has changed.",
                "Re-forecast the remaining cost to complete.",
            ],
            owner_email=project.manager,
            entity_type="Project",
            entity_id=project.source_id,
            entity_label=project.name,
            facts={
                "budget": budget,
                "actual_cost": float(project.actual_cost or 0.0),
                "overrun_pct": round(ratio * 100, 1),
                "completion_pct": project.completion_percentage,
                "manager": project.manager,
            },
            source_refs=[_ref("Project", project.source_id, project.name)],
        ))
    return findings


@rule("LEAD_DORMANT")
def _lead_dormant(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    max_idle_days = _threshold(rule_row, "idle_days", 30)
    cutoff = models.utcnow() - datetime.timedelta(days=max_idle_days)
    open_statuses = ("new", "contacted", "qualified")
    findings = []

    leads = (
        db.query(models.CRMLead)
        .filter(
            models.CRMLead.status.in_(open_statuses),
            models.CRMLead.last_activity_at.isnot(None),
            models.CRMLead.last_activity_at < cutoff,
        )
        .all()
    )
    for lead in leads:
        idle_days = (models.utcnow() - lead.last_activity_at).days
        findings.append(Finding(
            dedupe_key=f"LEAD_DORMANT:{lead.source_id}",
            rule_code="LEAD_DORMANT",
            title="Lead inactive for an extended period",
            module="crm",
            domain="business",
            severity=_escalate("low", float(lead.amount or 0.0), 750_000, 250_000),
            what_happened=(
                f"Lead {lead.company} has had no recorded activity for {idle_days} days."
            ),
            why_it_matters=(
                "Conversion probability drops sharply with inactivity, and the pipeline value "
                "attached to the lead is likely overstated."
            ),
            financial_impact=float(lead.amount or 0.0),
            impact_label="Conversion at risk",
            recommended_actions=[
                f"Contact {lead.company} and record the outcome.",
                "Re-qualify or close the lead so the pipeline reflects reality.",
            ],
            owner_email=lead.owner,
            entity_type="CRMLead",
            entity_id=lead.source_id,
            entity_label=lead.company,
            facts={
                "owner": lead.owner,
                "status": lead.status,
                "idle_days": idle_days,
                "last_activity": lead.last_activity_at.isoformat(),
                "value": float(lead.amount or 0.0),
            },
            source_refs=[_ref("CRMLead", lead.source_id, lead.company)],
        ))
    return findings


@rule("RESOURCE_OVERALLOCATION")
def _resource_overallocation(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    ceiling = _threshold(rule_row, "max_allocation_pct", 100)
    rows = (
        db.query(
            models.ResourceAllocation.resource_name,
            models.ResourceAllocation.discipline,
            models.ResourceAllocation.week_starting,
            func.sum(models.ResourceAllocation.allocation_percentage).label("total"),
            func.count(models.ResourceAllocation.id).label("assignments"),
        )
        .group_by(
            models.ResourceAllocation.resource_name,
            models.ResourceAllocation.discipline,
            models.ResourceAllocation.week_starting,
        )
        .having(func.sum(models.ResourceAllocation.allocation_percentage) > ceiling)
        .all()
    )
    findings = []
    for row in rows:
        overload = float(row.total) - 100
        findings.append(Finding(
            dedupe_key=f"RESOURCE_OVERALLOCATION:{row.resource_name}:{row.week_starting}",
            rule_code="RESOURCE_OVERALLOCATION",
            title="Resource overallocation detected",
            module="projects",
            domain="business",
            severity="medium" if row.total < 150 else "high",
            what_happened=(
                f"{row.resource_name} is assigned to {row.assignments} projects totalling "
                f"{row.total:.0f}% of available capacity in the week of {row.week_starting}."
            ),
            why_it_matters=(
                "Committed dates on at least one of those projects cannot be met at this "
                "allocation, so the slippage is already baked in."
            ),
            financial_impact=0.0,
            impact_label="Project delay risk",
            recommended_actions=[
                "Rebalance the allocation across the assigned projects.",
                "Confirm revised dates with the affected project managers.",
            ],
            owner_email=None,
            entity_type="ResourceAllocation",
            entity_id=f"{row.resource_name}:{row.week_starting}",
            entity_label=row.resource_name,
            facts={
                "resource": row.resource_name,
                "discipline": row.discipline,
                "week_starting": str(row.week_starting),
                "allocation_pct": float(row.total),
                "overload_pct": round(overload, 1),
                "assignments": row.assignments,
            },
            source_refs=[_ref("ResourceAllocation", row.resource_name, row.resource_name)],
        ))
    return findings


@rule("SCHEDULE_SLIPPAGE")
def _schedule_slippage(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    max_slip_days = _threshold(rule_row, "slip_days", 7)
    tasks = (
        db.query(models.ProjectTask)
        .filter(
            models.ProjectTask.status != "completed",
            models.ProjectTask.forecast_end.isnot(None),
            models.ProjectTask.baseline_end.isnot(None),
        )
        .all()
    )
    findings = []
    for task in tasks:
        slip = (task.forecast_end - task.baseline_end).days
        if slip <= max_slip_days:
            continue
        project = task.project
        findings.append(Finding(
            dedupe_key=f"SCHEDULE_SLIPPAGE:{task.source_id}",
            rule_code="SCHEDULE_SLIPPAGE",
            title="Task delayed beyond baseline",
            module="projects",
            domain="business",
            severity="high" if slip > 21 else "low" if slip <= 10 else "medium",
            what_happened=(
                f'"{task.name}" on {project.name if project else "a project"} is forecast to '
                f"finish {slip} days after its baseline date."
            ),
            why_it_matters=(
                "Downstream tasks and the contractual completion date move with it, and "
                "delay penalties may apply."
            ),
            financial_impact=0.0,
            impact_label="Schedule delay",
            recommended_actions=[
                "Confirm the revised forecast with the task owner.",
                "Assess the impact on the critical path and the contractual end date.",
            ],
            owner_email=task.owner,
            entity_type="ProjectTask",
            entity_id=task.source_id,
            entity_label=f"{project.name if project else ''} — {task.name}",
            facts={
                "project": project.name if project else None,
                "task": task.name,
                "baseline_end": str(task.baseline_end),
                "forecast_end": str(task.forecast_end),
                "slip_days": slip,
            },
            source_refs=[
                _ref("ProjectTask", task.source_id, task.name),
                *([_ref("Project", project.source_id, project.name)] if project else []),
            ],
        ))
    return findings


@rule("QUOTATION_NOT_FOLLOWED_UP")
def _quotation_not_followed_up(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    max_idle_days = _threshold(rule_row, "idle_days", 14)
    now = models.utcnow()
    quotations = (
        db.query(models.CRMQuotation).filter(models.CRMQuotation.status == "sent").all()
    )
    findings = []
    for quote in quotations:
        last_touch = quote.last_followup_at or quote.sent_at
        if last_touch is None:
            continue
        idle_days = (now - last_touch).days
        if idle_days <= max_idle_days:
            continue
        findings.append(Finding(
            dedupe_key=f"QUOTATION_NOT_FOLLOWED_UP:{quote.source_id}",
            rule_code="QUOTATION_NOT_FOLLOWED_UP",
            title="Quotation not followed up",
            module="crm",
            domain="business",
            severity=_escalate("low", float(quote.amount or 0.0), 300_000, 75_000),
            what_happened=(
                f"Quotation {quote.source_id} to {quote.customer} has not been followed up "
                f"for {idle_days} days."
            ),
            why_it_matters=(
                "Win probability falls the longer a quotation sits unattended, and the "
                "customer may already be committed elsewhere."
            ),
            financial_impact=float(quote.amount or 0.0),
            impact_label="Win probability drop",
            recommended_actions=[
                f"Call {quote.customer} to confirm the quotation status.",
                "Record the outcome so the pipeline reflects it.",
            ],
            owner_email=quote.owner,
            entity_type="CRMQuotation",
            entity_id=quote.source_id,
            entity_label=f"{quote.source_id} — {quote.customer}",
            facts={
                "customer": quote.customer,
                "amount": float(quote.amount or 0.0),
                "sent_at": quote.sent_at.isoformat() if quote.sent_at else None,
                "idle_days": idle_days,
                "owner": quote.owner,
            },
            source_refs=[_ref("CRMQuotation", quote.source_id, quote.source_id)],
        ))
    return findings


# ---------------------------------------------------------------------------
# Software-usage rules
# ---------------------------------------------------------------------------

@rule("LOGIN_FAILURE_BURST")
def _login_failure_burst(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    window_minutes = _param(rule_row, "window_minutes", 30)
    min_attempts = _threshold(rule_row, "min_attempts", 10)
    since = models.utcnow() - datetime.timedelta(hours=_param(rule_row, "lookback_hours", 24))

    events = (
        db.query(models.SystemUsageEvent)
        .filter(
            models.SystemUsageEvent.event_type == "login_failed",
            models.SystemUsageEvent.at >= since,
        )
        .order_by(models.SystemUsageEvent.at)
        .all()
    )
    by_user: dict[str, list[models.SystemUsageEvent]] = {}
    for event in events:
        by_user.setdefault(event.user_email, []).append(event)

    findings = []
    for user_email, user_events in by_user.items():
        window = datetime.timedelta(minutes=window_minutes)
        burst: list[models.SystemUsageEvent] = []
        for index, event in enumerate(user_events):
            window_events = [
                e for e in user_events[index:] if e.at - event.at <= window
            ]
            if len(window_events) > len(burst):
                burst = window_events
        if len(burst) < min_attempts:
            continue
        first, last = burst[0], burst[-1]
        findings.append(Finding(
            dedupe_key=f"LOGIN_FAILURE_BURST:{user_email}:{first.at:%Y%m%d%H}",
            rule_code="LOGIN_FAILURE_BURST",
            title="High system login failures",
            module="security",
            domain="software_usage",
            severity="high" if len(burst) >= min_attempts * 2 else "medium",
            what_happened=(
                f"{len(burst)} failed login attempts for {user_email} within "
                f"{window_minutes} minutes from {first.ip_address}."
            ),
            why_it_matters=(
                "A burst of failures on one account is the signature of a credential "
                "attack; a successful attempt afterwards would go unnoticed."
            ),
            financial_impact=0.0,
            impact_label="Account security",
            recommended_actions=[
                f"Verify with {user_email} whether the attempts were theirs.",
                "Force a password reset and confirm MFA is enrolled.",
                "Block the source IP if the attempts were not legitimate.",
            ],
            owner_email=None,
            entity_type="User",
            entity_id=user_email,
            entity_label=user_email,
            facts={
                "attempts": len(burst),
                "window_minutes": window_minutes,
                "first_attempt": first.at.isoformat(),
                "last_attempt": last.at.isoformat(),
                "ip_address": first.ip_address,
                "system": first.system,
            },
            source_refs=[_ref("SystemUsageEvent", e.id, f"{e.at:%d %b %H:%M} {e.ip_address}") for e in burst[:20]],
        ))
    return findings


@rule("OFF_HOURS_ACCESS")
def _off_hours_access(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    start_hour, end_hour = _param(rule_row, "business_hours", list(BUSINESS_HOURS))
    since = models.utcnow() - datetime.timedelta(hours=_param(rule_row, "lookback_hours", 72))
    events = (
        db.query(models.SystemUsageEvent)
        .filter(
            models.SystemUsageEvent.event_type == "login_success",
            models.SystemUsageEvent.at >= since,
        )
        .all()
    )
    findings = []
    seen_days: set[tuple[str, str]] = set()
    for event in events:
        if start_hour <= event.at.hour < end_hour:
            continue
        # One finding per user per day: a night shift produces a stream of
        # sign-ins, and a row for each of them is noise, not signal.
        day_key = (event.user_email, event.at.strftime("%Y%m%d"))
        if day_key in seen_days:
            continue
        seen_days.add(day_key)
        findings.append(Finding(
            dedupe_key=f"OFF_HOURS_ACCESS:{event.user_email}:{event.at:%Y%m%d}",
            rule_code="OFF_HOURS_ACCESS",
            title="Off-hours system access",
            module="security",
            domain="software_usage",
            severity="medium",
            what_happened=(
                f"{event.user_email} signed in to {event.system} at "
                f"{event.at:%H:%M on %d %b}, outside the {start_hour:02d}:00–{end_hour:02d}:00 window."
            ),
            why_it_matters=(
                "Access outside working hours is the window in which unauthorised changes "
                "are least likely to be noticed."
            ),
            financial_impact=0.0,
            impact_label="Access control",
            recommended_actions=[
                f"Confirm the session with {event.user_email}.",
                "Review what was changed during the session in the audit log.",
            ],
            entity_type="SystemUsageEvent",
            entity_id=str(event.id),
            entity_label=event.user_email,
            facts={
                "user": event.user_email,
                "system": event.system,
                "at": event.at.isoformat(),
                "ip_address": event.ip_address,
                "country": event.country,
            },
            source_refs=[_ref("SystemUsageEvent", event.id, f"{event.at:%d %b %H:%M}")],
        ))
    return findings


@rule("OUT_OF_GEOGRAPHY_ACCESS")
def _out_of_geography(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    allowed = set(_param(rule_row, "allowed_countries", ["SA"]))
    since = models.utcnow() - datetime.timedelta(hours=_param(rule_row, "lookback_hours", 72))
    events = (
        db.query(models.SystemUsageEvent)
        .filter(
            models.SystemUsageEvent.event_type == "login_success",
            models.SystemUsageEvent.at >= since,
            models.SystemUsageEvent.country.notin_(allowed),
        )
        .all()
    )
    return [
        Finding(
            dedupe_key=f"OUT_OF_GEOGRAPHY_ACCESS:{event.user_email}:{event.at:%Y%m%d%H%M}",
            rule_code="OUT_OF_GEOGRAPHY_ACCESS",
            title="Access from an unexpected country",
            module="security",
            domain="software_usage",
            severity="high",
            what_happened=(
                f"{event.user_email} signed in to {event.system} from {event.country} "
                f"({event.ip_address}) at {event.at:%H:%M on %d %b}."
            ),
            why_it_matters=(
                "Sign-ins from outside the approved operating geography are either "
                "unapproved travel or a compromised credential."
            ),
            financial_impact=0.0,
            impact_label="Access control",
            recommended_actions=[
                f"Contact {event.user_email} to confirm the location.",
                "Suspend the session and reset credentials if unconfirmed.",
            ],
            entity_type="SystemUsageEvent",
            entity_id=str(event.id),
            entity_label=event.user_email,
            facts={
                "user": event.user_email,
                "country": event.country,
                "ip_address": event.ip_address,
                "system": event.system,
                "at": event.at.isoformat(),
            },
            source_refs=[_ref("SystemUsageEvent", event.id, f"{event.country} {event.at:%d %b %H:%M}")],
        )
        for event in events
    ]


@rule("BULK_DELETE")
def _bulk_delete(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    min_records = _threshold(rule_row, "min_records", 25)
    since = models.utcnow() - datetime.timedelta(hours=_param(rule_row, "lookback_hours", 72))
    events = (
        db.query(models.SystemUsageEvent)
        .filter(
            models.SystemUsageEvent.event_type == "record_deleted",
            models.SystemUsageEvent.at >= since,
            models.SystemUsageEvent.record_count >= min_records,
        )
        .all()
    )
    return [
        Finding(
            dedupe_key=f"BULK_DELETE:{event.id}",
            rule_code="BULK_DELETE",
            title="Bulk record deletion",
            module="security",
            domain="software_usage",
            severity="high",
            what_happened=(
                f"{event.user_email} deleted {event.record_count} {event.entity_type or 'records'} "
                f"in {event.system} at {event.at:%H:%M on %d %b}."
            ),
            why_it_matters=(
                "Bulk deletions remove the audit trail behind reported figures and are "
                "rarely a legitimate day-to-day operation."
            ),
            financial_impact=0.0,
            impact_label="Data integrity",
            recommended_actions=[
                f"Ask {event.user_email} to confirm the deletion was intended.",
                "Restore from backup if the deletion was not authorised.",
                "Review the user's delete permission.",
            ],
            entity_type="SystemUsageEvent",
            entity_id=str(event.id),
            entity_label=event.user_email,
            facts={
                "user": event.user_email,
                "records": event.record_count,
                "entity_type": event.entity_type,
                "system": event.system,
                "at": event.at.isoformat(),
            },
            source_refs=[_ref("SystemUsageEvent", event.id, f"{event.record_count} records")],
        )
        for event in events
    ]


@rule("PERMISSION_CHANGE")
def _permission_change(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    since = models.utcnow() - datetime.timedelta(hours=_param(rule_row, "lookback_hours", 168))
    events = (
        db.query(models.SystemUsageEvent)
        .filter(
            models.SystemUsageEvent.event_type == "permission_changed",
            models.SystemUsageEvent.at >= since,
        )
        .all()
    )
    return [
        Finding(
            dedupe_key=f"PERMISSION_CHANGE:{event.id}",
            rule_code="PERMISSION_CHANGE",
            title="Permission change on a privileged account",
            module="security",
            domain="software_usage",
            severity="medium",
            what_happened=(
                f"{event.user_email} changed permissions on "
                f"{event.entity_id or 'an account'} in {event.system} "
                f"({(event.details or {}).get('change', 'role updated')})."
            ),
            why_it_matters=(
                "Permission changes alter who can see and edit financial data; unreviewed "
                "changes break segregation of duties."
            ),
            financial_impact=0.0,
            impact_label="Segregation of duties",
            recommended_actions=[
                "Confirm the change was requested and approved.",
                "Revert the change if no approval exists.",
            ],
            entity_type="SystemUsageEvent",
            entity_id=str(event.id),
            entity_label=event.entity_id or event.user_email,
            facts={
                "changed_by": event.user_email,
                "target": event.entity_id,
                "system": event.system,
                "at": event.at.isoformat(),
                **(event.details or {}),
            },
            source_refs=[_ref("SystemUsageEvent", event.id, "permission change")],
        )
        for event in events
    ]


@rule("CLOSED_PERIOD_EDIT")
def _closed_period_edit(db: Session, rule_row: models.AnomalyRule) -> list[Finding]:
    since = models.utcnow() - datetime.timedelta(hours=_param(rule_row, "lookback_hours", 168))
    events = (
        db.query(models.SystemUsageEvent)
        .filter(
            models.SystemUsageEvent.event_type == "record_edited",
            models.SystemUsageEvent.period_closed.is_(True),
            models.SystemUsageEvent.at >= since,
        )
        .all()
    )
    return [
        Finding(
            dedupe_key=f"CLOSED_PERIOD_EDIT:{event.id}",
            rule_code="CLOSED_PERIOD_EDIT",
            title="Edit to a closed accounting period",
            module="finance",
            domain="software_usage",
            severity="high",
            what_happened=(
                f"{event.user_email} edited {event.entity_type or 'a record'} "
                f"{event.entity_id or ''} in {event.system}, which belongs to a closed period."
            ),
            why_it_matters=(
                "Reports already issued for that period no longer match the source system, "
                "so previously approved figures are now wrong."
            ),
            financial_impact=float((event.details or {}).get("amount", 0.0) or 0.0),
            impact_label="Restatement risk",
            recommended_actions=[
                "Identify which published reports covered the affected period.",
                "Reverse the edit or re-issue the affected report with a restatement note.",
                "Lock the period in the source system.",
            ],
            entity_type="SystemUsageEvent",
            entity_id=str(event.id),
            entity_label=f"{event.entity_type} {event.entity_id}",
            facts={
                "user": event.user_email,
                "system": event.system,
                "record": f"{event.entity_type} {event.entity_id}",
                "at": event.at.isoformat(),
                **(event.details or {}),
            },
            source_refs=[_ref("SystemUsageEvent", event.id, "closed-period edit")],
        )
        for event in events
    ]


# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

def _reference_sequence(db: Session, detected_at: datetime.datetime):
    """Hand out references for one scan.

    The counter is kept in the closure rather than re-queried per finding,
    because rows added during a scan are not visible to a count until flush.
    """
    prefix = f"ANM-{detected_at:%Y-%m%d}"
    used = (
        db.query(func.count(models.Anomaly.id))
        .filter(models.Anomaly.reference.like(f"{prefix}%"))
        .scalar()
        or 0
    )

    def next_reference() -> str:
        nonlocal used
        used += 1
        return f"{prefix}-{used:03d}"

    return next_reference


def scan(db: Session, *, actor_email: str = "scheduler@misagent.local") -> dict:
    """Run every enabled rule and reconcile the findings with existing anomalies."""
    detected_at = models.utcnow()
    created, updated, suppressed = 0, 0, 0
    immediate_alerts: list[models.Anomaly] = []
    next_reference = _reference_sequence(db, detected_at)

    team_by_module = {
        team_module: team.id
        for team in db.query(models.Team).all()
        for team_module in (team.scope_modules or [])
    }

    for rule_row in db.query(models.AnomalyRule).filter(models.AnomalyRule.enabled.is_(True)).all():
        handler = RULES.get(rule_row.code)
        if handler is None:
            continue

        for finding in handler(db, rule_row):
            existing = (
                db.query(models.Anomaly)
                .filter(models.Anomaly.dedupe_key == finding.dedupe_key)
                .first()
            )
            if existing and existing.status in SUPPRESSED_STATUSES:
                suppressed += 1
                continue

            if existing:
                existing.severity = finding.severity
                existing.financial_impact = finding.financial_impact
                existing.facts = finding.facts
                existing.what_happened = finding.what_happened
                existing.source_refs = finding.source_refs
                updated += 1
                continue

            anomaly = models.Anomaly(
                reference=next_reference(),
                dedupe_key=finding.dedupe_key,
                rule_code=finding.rule_code,
                domain=finding.domain,
                module=finding.module,
                severity=finding.severity,
                title=finding.title,
                detected_at=detected_at,
                status="active",
                what_happened=finding.what_happened,
                why_it_matters=finding.why_it_matters,
                financial_impact=finding.financial_impact,
                impact_label=finding.impact_label,
                recommended_actions=finding.recommended_actions,
                owner_email=finding.owner_email,
                owner_team_id=team_by_module.get(finding.module),
                entity_type=finding.entity_type,
                entity_id=finding.entity_id,
                entity_label=finding.entity_label,
                facts=finding.facts,
                source_refs=finding.source_refs,
            )
            if rule_row.alert_immediately and finding.severity == "high":
                anomaly.alert_sent_at = detected_at
                immediate_alerts.append(anomaly)

            db.add(anomaly)
            rule_row.detections = (rule_row.detections or 0) + 1
            created += 1

    db.commit()

    summary = {
        "scanned_at": detected_at.isoformat(),
        "created": created,
        "updated": updated,
        "suppressed": suppressed,
        "immediate_alerts": len(immediate_alerts),
        "rules_run": len(RULES),
    }
    audit.record(
        db,
        actor_email=actor_email,
        actor_role="system",
        action="anomaly.scan",
        entity_type="anomaly_scan",
        entity_id=detected_at.strftime("%Y%m%d%H%M%S"),
        summary=f"Scan raised {created} new and updated {updated} anomalies",
        details=summary,
    )
    return summary


def set_status(
    db: Session,
    anomaly: models.Anomaly,
    status: str,
    *,
    actor_email: str,
    actor_role: str,
    note: str | None = None,
) -> models.Anomaly:
    """Change an anomaly's status. Marking a false positive tunes its rule."""
    valid = ("active", "investigating", "resolved", "ignored", "false_positive")
    if status not in valid:
        raise ValueError(f"status must be one of {valid}")

    anomaly.status = status
    anomaly.resolution_note = note or anomaly.resolution_note
    if status in ("resolved", "false_positive", "ignored"):
        anomaly.resolved_at = models.utcnow()

    action = "anomaly.status_changed"
    if status == "false_positive":
        action = "anomaly.false_positive"
        rule_row = (
            db.query(models.AnomalyRule)
            .filter(models.AnomalyRule.code == anomaly.rule_code)
            .first()
        )
        if rule_row:
            rule_row.false_positives = (rule_row.false_positives or 0) + 1
            # Tighten the rule in proportion to how often it cries wolf. The
            # denominator floor keeps one mark on a rarely-firing rule from
            # doubling its threshold, and the cap stops a handful of marks from
            # silencing the rule entirely.
            fp_rate = rule_row.false_positives / max(rule_row.detections or 0, 10)
            rule_row.sensitivity = round(min(1.0 + fp_rate, 2.0), 2)

    db.commit()
    db.refresh(anomaly)

    audit.record(
        db,
        actor_email=actor_email,
        actor_role=actor_role,
        action=action,
        entity_type="anomaly",
        entity_id=anomaly.reference,
        summary=f"{anomaly.reference} marked {status}",
        details={"note": note, "rule": anomaly.rule_code},
    )
    return anomaly
