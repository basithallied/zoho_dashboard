"""Dashboard, data sources, people, audit trail and source-record lookup."""

from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import database
import models
from deps import get_principal
from routers import serializers
from services import audit, metrics, rbac
from services.calendar_rules import named_period

router = APIRouter(prefix="/api", tags=["platform"])


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def dashboard(
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    now = models.utcnow()
    templates = [
        t for t in db.query(models.ReportTemplate).all() if principal.can_read(t.module)
    ]
    runs = db.query(models.ReportRun).all()
    visible_runs = [
        r for r in runs if r.template and principal.can_read(r.template.module)
    ]
    sent_today = [
        r for r in visible_runs if r.published_at and r.published_at.date() == now.date()
    ]
    pending_approvals = [
        a for a in db.query(models.Approval).filter(models.Approval.status == "pending").all()
        if a.run and a.run.template and principal.can_read(a.run.template.module)
    ]
    anomalies = (
        db.query(models.Anomaly)
        .filter(
            models.Anomaly.module.in_(principal.modules),
            models.Anomaly.status.in_(("active", "investigating")),
        )
        .order_by(models.Anomaly.detected_at.desc())
        .all()
    )

    upcoming = sorted([t for t in templates if t.next_run_at], key=lambda t: t.next_run_at)[:6]

    sent_by_module: dict[str, int] = {}
    for run in visible_runs:
        if run.published_at and run.published_at.date() == now.date():
            module = run.template.module if run.template else "other"
            sent_by_module[module] = sent_by_module.get(module, 0) + 1

    return {
        "user": {
            "email": principal.email,
            "name": principal.full_name,
            "role": principal.role,
            "team": principal.team_name,
            "modules": list(principal.modules),
        },
        "cards": {
            "reports_scheduled": len(templates),
            "reports_sent_today": len(sent_today),
            "pending_approvals": len(pending_approvals),
            "anomalies_detected": len([a for a in anomalies if a.status == "active"]),
        },
        "upcoming_runs": [
            {
                "id": t.id,
                "name": t.name,
                "cadence": t.cadence,
                "next_run_at": t.next_run_at.isoformat(),
                "recipients": len(t.recipients or []),
                "team": t.owner_team.name if t.owner_team else None,
                "status": "scheduled" if t.is_active else "paused",
            }
            for t in upcoming
        ],
        "pending_approvals": [
            {
                "approval_id": a.id,
                "run_id": a.run_id,
                "report": a.run.template.name,
                "period": a.run.period_label,
                "team": a.run.template.reviewer_team.name if a.run.template.reviewer_team else None,
                "requested_at": a.requested_at.isoformat() if a.requested_at else None,
                "opened": a.opened_at is not None,
                "escalated": a.escalated_at is not None,
            }
            for a in sorted(pending_approvals, key=lambda a: a.requested_at or now, reverse=True)[:5]
        ],
        "recent_anomalies": [
            serializers.anomaly(a, include_detail=False) for a in anomalies[:5]
        ],
        "reports_sent_by_module": [
            {"module": k, "count": v} for k, v in sent_by_module.items()
        ],
        "data_sources": [
            serializers.data_source(s) for s in db.query(models.DataSource).all()
        ],
        "headline_metrics": _headline_metrics(db, principal),
    }


def _headline_metrics(db: Session, principal: rbac.Principal) -> list[dict]:
    """A small set of figures for the dashboard, each with its source count."""
    period = named_period("this month", models.utcnow())
    keys = ("revenue_invoiced", "overdue_receivables", "pipeline_value", "active_projects")
    output = []
    for key in keys:
        metric = metrics.get(key)
        if metric is None or not principal.can_read(metric.module):
            continue
        result = metric.compute(db, period)
        prior = metric.compute(db, period.previous())
        change = None
        if prior.value:
            change = round((result.value - prior.value) / abs(prior.value) * 100, 1)
        output.append({
            **result.as_dict(),
            "change_pct": change,
            "comparison_period": prior.period_label,
            "source_refs": result.source_refs[:5],
        })
    return output


@router.get("/dashboard/trend")
def dashboard_trend(
    metric_key: str = Query(default="revenue_invoiced"),
    period_name: str = Query(default="this year"),
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    metric = metrics.get(metric_key)
    if metric is None:
        raise HTTPException(status_code=404, detail="Unknown metric.")
    rbac.assert_can_read_module(principal, metric.module)
    period = named_period(period_name, models.utcnow()) or named_period("this year", models.utcnow())
    return {
        "metric": metric.key,
        "label": metric.label,
        "unit": metric.unit,
        "period": period.label,
        "points": metrics.series(db, metric, period),
    }


# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------

@router.get("/data-sources")
def list_data_sources(db: Session = Depends(database.get_db)):
    return [serializers.data_source(s) for s in db.query(models.DataSource).all()]


@router.post("/data-sources/{source_id}/sync")
def sync_source(
    source_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rbac.assert_can(principal, "manage_sources")
    source = db.get(models.DataSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Data source not found.")
    source.last_sync_at = models.utcnow()
    source.status = "connected"
    source.last_error = None
    db.commit()
    db.refresh(source)

    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="source.synced",
        entity_type="data_source",
        entity_id=source.id,
        summary=f"Manual sync of {source.name}",
    )
    return serializers.data_source(source)


# ---------------------------------------------------------------------------
# Source-record lookup — this is what makes a figure openable
# ---------------------------------------------------------------------------

RECORD_MODELS = {
    "Invoice": (models.Invoice, "source_id"),
    "Expense": (models.Expense, "source_id"),
    "CRMLead": (models.CRMLead, "source_id"),
    "CRMDeal": (models.CRMDeal, "source_id"),
    "CRMQuotation": (models.CRMQuotation, "source_id"),
    "Project": (models.Project, "source_id"),
    "ProjectMilestone": (models.ProjectMilestone, "source_id"),
    "ProjectTask": (models.ProjectTask, "source_id"),
    "HeadcountRecord": (models.HeadcountRecord, "id"),
    "SystemUsageEvent": (models.SystemUsageEvent, "id"),
}


@router.get("/records/{entity_type}/{entity_id}")
def get_source_record(
    entity_type: str,
    entity_id: str,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    """Open the record behind a figure. Finance will not trust a number it cannot open."""
    entry = RECORD_MODELS.get(entity_type)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"No source records of type {entity_type}.")
    model, key_attr = entry

    column = getattr(model, key_attr)
    lookup = int(entity_id) if key_attr == "id" and entity_id.isdigit() else entity_id
    row = db.query(model).filter(column == lookup).first()
    if row is None and entity_id.isdigit():
        row = db.query(model).get(int(entity_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Source record not found.")

    fields = {}
    for attribute in row.__table__.columns.keys():
        value = getattr(row, attribute)
        if isinstance(value, (datetime.datetime, datetime.date)):
            value = value.isoformat()
        fields[attribute] = value

    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="record.viewed",
        entity_type=entity_type,
        entity_id=entity_id,
        summary=f"Opened source record {entity_type} {entity_id}",
    )
    return {"entity_type": entity_type, "entity_id": entity_id, "fields": fields}


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(db: Session = Depends(database.get_db)):
    return [serializers.user(u) for u in db.query(models.User).order_by(models.User.full_name).all()]


@router.get("/teams")
def list_teams(db: Session = Depends(database.get_db)):
    teams = db.query(models.Team).order_by(models.Team.name).all()
    return [
        {
            **serializers.team(team),
            "member_count": len(team.members),
            "members": [serializers.user(m) for m in team.members],
        }
        for team in teams
    ]


@router.get("/me")
def me(principal: rbac.Principal = Depends(get_principal)):
    return {
        "email": principal.email,
        "name": principal.full_name,
        "role": principal.role,
        "team": principal.team_name,
        "modules": list(principal.modules),
        "permissions": sorted(rbac.ROLE_ACTIONS.get(principal.role, set())),
    }


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

@router.get("/audit-logs")
def list_audit_logs(
    action: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    days: int = Query(default=30, le=365),
    limit: int = Query(default=200, le=1000),
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    since = models.utcnow() - datetime.timedelta(days=days)
    query = db.query(models.AuditLog).filter(models.AuditLog.at >= since)
    if action and action != "all":
        query = query.filter(models.AuditLog.action == action)
    if actor:
        query = query.filter(models.AuditLog.actor_email.ilike(f"%{actor}%"))
    if entity_type and entity_type != "all":
        query = query.filter(models.AuditLog.entity_type == entity_type)
    rows = query.order_by(models.AuditLog.at.desc()).limit(limit).all()
    return [serializers.audit_entry(row) for row in rows]


@router.get("/audit-logs/actions")
def audit_actions(db: Session = Depends(database.get_db)):
    rows = db.query(models.AuditLog.action).distinct().all()
    return sorted(row[0] for row in rows if row[0])
