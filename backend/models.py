"""Domain model for the MIS Agent.

Three groups of tables live here:

1. Source records mirrored from the connected systems (ERP / CRM / HRMS / DB).
   The agent only ever reads these — it never posts entries back. Every figure
   the agent reports has to be traceable to a row in this group.
2. Agent state: report templates, runs, approvals, anomalies, conversations.
3. Governance: users, teams, data sources, audit log.
"""

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text,
)
from sqlalchemy.orm import relationship
import datetime

from database import Base


def utcnow():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Governance
# ---------------------------------------------------------------------------

class Team(Base):
    """A reviewing / owning team. Report routing points at teams, not people."""

    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    # Modules this team is allowed to see: subset of crm/projects/finance/hr/procurement
    scope_modules = Column(JSON, default=list)

    members = relationship("User", back_populates="team")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    # top_management | reviewer | analyst | viewer | admin
    role = Column(String, default="viewer")
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    last_login_at = Column(DateTime, nullable=True)

    team = relationship("Team", back_populates="members")


class DataSource(Base):
    """A connected system. Read-only by design — see `access_mode`."""

    __tablename__ = "data_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    kind = Column(String)            # erp | crm | hrms | database
    vendor = Column(String)
    status = Column(String, default="connected")   # connected | degraded | disconnected
    access_mode = Column(String, default="read_only")
    last_sync_at = Column(DateTime, default=utcnow)
    sync_interval_minutes = Column(Integer, default=15)
    record_count = Column(Integer, default=0)
    last_error = Column(String, nullable=True)


class AuditLog(Base):
    """Append-only record of who saw what, when, and what changed."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    at = Column(DateTime, default=utcnow, index=True)
    actor_email = Column(String, index=True)
    actor_role = Column(String)
    # report.generated | report.viewed | report.approved | report.rejected |
    # report.published | anomaly.status_changed | anomaly.false_positive |
    # chat.answered | source.synced | settings.changed
    action = Column(String, index=True)
    entity_type = Column(String, index=True)
    entity_id = Column(String, index=True)
    summary = Column(String)
    details = Column(JSON, default=dict)
    ip_address = Column(String, nullable=True)


# ---------------------------------------------------------------------------
# Report engine
# ---------------------------------------------------------------------------

class ReportTemplate(Base):
    """Report definitions are configuration, not code.

    `sections` holds the layout: a list of
    ``{"key", "title", "metrics": [...], "comparison": "prior_period|prior_year|none"}``.
    `thresholds` holds the commentary trigger points, e.g. ``{"overdue_ratio": 0.2}``.
    """

    __tablename__ = "report_templates"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(String, default="")
    module = Column(String, default="all")
    cadence = Column(String, default="daily")     # daily | weekly | monthly | quarterly
    delivery_hour = Column(Integer, default=7)
    is_active = Column(Boolean, default=True)

    sections = Column(JSON, default=list)
    thresholds = Column(JSON, default=dict)
    default_comparison = Column(String, default="prior_period")

    # Routing matrix
    owner_team_id = Column(Integer, ForeignKey("teams.id"))
    reviewer_team_id = Column(Integer, ForeignKey("teams.id"))
    escalation_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    escalation_after_hours = Column(Integer, default=24)
    recipients = Column(JSON, default=list)       # emails reached once approved

    next_run_at = Column(DateTime, nullable=True)
    last_run_at = Column(DateTime, nullable=True)

    owner_team = relationship("Team", foreign_keys=[owner_team_id])
    reviewer_team = relationship("Team", foreign_keys=[reviewer_team_id])
    escalation_team = relationship("Team", foreign_keys=[escalation_team_id])
    runs = relationship("ReportRun", back_populates="template", cascade="all, delete-orphan")


class ReportRun(Base):
    """One generated instance of a template for one period."""

    __tablename__ = "report_runs"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("report_templates.id"), index=True)
    period_label = Column(String)                 # "11 Aug 2026", "Week 32 2026", "Jul 2026"
    period_start = Column(DateTime)
    period_end = Column(DateTime)

    # draft -> in_review -> approved -> published, plus rejected / failed
    status = Column(String, default="draft", index=True)
    generated_at = Column(DateTime, default=utcnow)
    generation_ms = Column(Integer, default=0)
    published_at = Column(DateTime, nullable=True)
    delivery_status = Column(String, default="pending")   # pending | delivered | failed | skipped
    delivery_error = Column(String, nullable=True)

    # Rendered content. `figures` is the numbers (from source records only);
    # `commentary` is agent-written prose about those numbers.
    figures = Column(JSON, default=dict)
    commentary = Column(JSON, default=dict)
    source_refs = Column(JSON, default=list)

    template = relationship("ReportTemplate", back_populates="runs")
    approvals = relationship("Approval", back_populates="run", cascade="all, delete-orphan")
    annotations = relationship(
        "ReportAnnotation", back_populates="run", cascade="all, delete-orphan"
    )


class Approval(Base):
    """A reviewer's engagement with one run.

    A row is created when the run enters review. `opened_at` is stamped the
    first time the reviewer actually opens the content; approval is refused
    until it is set.
    """

    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("report_runs.id"), index=True)
    reviewer_team_id = Column(Integer, ForeignKey("teams.id"))
    reviewer_email = Column(String, nullable=True)
    status = Column(String, default="pending")    # pending | approved | rejected
    opened_at = Column(DateTime, nullable=True)
    decided_at = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=True)          # required on reject
    requested_at = Column(DateTime, default=utcnow)
    escalated_at = Column(DateTime, nullable=True)

    run = relationship("ReportRun", back_populates="approvals")


class ReportAnnotation(Base):
    """Line-item comment a reviewer leaves on a figure inside a run."""

    __tablename__ = "report_annotations"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("report_runs.id"), index=True)
    section_key = Column(String)
    metric_key = Column(String, nullable=True)
    author_email = Column(String)
    body = Column(Text)
    created_at = Column(DateTime, default=utcnow)

    run = relationship("ReportRun", back_populates="annotations")


# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------

class AnomalyRule(Base):
    """Tunable detection rule. False-positive marks feed back into `sensitivity`."""

    __tablename__ = "anomaly_rules"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    name = Column(String)
    domain = Column(String, default="business")   # business | software_usage
    module = Column(String)                       # projects | crm | finance | security | ...
    description = Column(String, default="")
    enabled = Column(Boolean, default=True)
    base_severity = Column(String, default="medium")
    params = Column(JSON, default=dict)           # thresholds, windows
    alert_immediately = Column(Boolean, default=False)
    detections = Column(Integer, default=0)
    false_positives = Column(Integer, default=0)
    # Multiplied into the rule threshold when tuning; >1 makes the rule stricter.
    sensitivity = Column(Float, default=1.0)


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String, unique=True, index=True)   # ANM-2026-0811-001
    # Deterministic per rule+entity+window, so a re-scan updates rather than duplicates.
    dedupe_key = Column(String, unique=True, index=True)
    rule_code = Column(String, ForeignKey("anomaly_rules.code"), index=True)
    domain = Column(String, default="business")
    module = Column(String, index=True)
    severity = Column(String, index=True)                 # high | medium | low | info
    title = Column(String)

    detected_at = Column(DateTime, default=utcnow, index=True)
    # active -> investigating -> resolved, plus ignored / false_positive
    status = Column(String, default="active", index=True)
    resolved_at = Column(DateTime, nullable=True)

    # The four things every item has to explain about itself.
    what_happened = Column(Text)
    why_it_matters = Column(Text)
    financial_impact = Column(Float, default=0.0)
    impact_label = Column(String, default="")
    recommended_actions = Column(JSON, default=list)

    owner_email = Column(String, nullable=True)
    owner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    entity_label = Column(String, nullable=True)
    facts = Column(JSON, default=dict)            # the numbers behind the finding
    source_refs = Column(JSON, default=list)
    alert_sent_at = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)


# ---------------------------------------------------------------------------
# Chat with data
# ---------------------------------------------------------------------------

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="New conversation")
    user_email = Column(String, index=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)
    # Carries context across turns: last metric, period and grouping.
    context = Column(JSON, default=dict)
    is_saved = Column(Boolean, default=False)

    messages = relationship(
        "ChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.id",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    role = Column(String)                         # user | agent
    text = Column(Text)
    # Structured answer: kpis, chart, table, sources, confidence, limits.
    payload = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)

    conversation = relationship("Conversation", back_populates="messages")


# ---------------------------------------------------------------------------
# Source records (read-only mirrors of the connected systems)
# ---------------------------------------------------------------------------

class CRMLead(Base):
    __tablename__ = "crm_leads"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, index=True)
    company = Column(String)
    contact_name = Column(String)
    status = Column(String)
    lead_source = Column(String)
    owner = Column(String)
    business_unit = Column(String)
    amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utcnow)
    last_activity_at = Column(DateTime, nullable=True)


class CRMDeal(Base):
    __tablename__ = "crm_deals"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, index=True)
    name = Column(String)
    customer = Column(String)
    stage = Column(String)
    amount = Column(Float, default=0.0)
    probability = Column(Integer, default=0)
    owner = Column(String)
    business_unit = Column(String)
    closing_date = Column(DateTime)
    created_at = Column(DateTime, default=utcnow)


class CRMQuotation(Base):
    __tablename__ = "crm_quotations"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, index=True)
    customer = Column(String)
    amount = Column(Float, default=0.0)
    status = Column(String)                       # sent | accepted | rejected | expired
    owner = Column(String)
    sent_at = Column(DateTime)
    last_followup_at = Column(DateTime, nullable=True)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, index=True)
    name = Column(String)
    customer = Column(String)
    status = Column(String)
    manager = Column(String)
    business_unit = Column(String)
    completion_percentage = Column(Integer, default=0)
    contract_value = Column(Float, default=0.0)
    budget = Column(Float, default=0.0)
    actual_cost = Column(Float, default=0.0)
    start_date = Column(DateTime)
    baseline_end_date = Column(DateTime)
    forecast_end_date = Column(DateTime)


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    name = Column(String)
    completion_percentage = Column(Integer, default=0)
    value = Column(Float, default=0.0)
    planned_completion = Column(Date, nullable=True)
    actual_completion = Column(Date, nullable=True)
    is_invoiced = Column(Boolean, default=False)

    project = relationship("Project")


class ProjectTask(Base):
    __tablename__ = "project_tasks"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    name = Column(String)
    owner = Column(String)
    status = Column(String)
    baseline_end = Column(Date)
    forecast_end = Column(Date)

    project = relationship("Project")


class ResourceAllocation(Base):
    __tablename__ = "resource_allocations"

    id = Column(Integer, primary_key=True, index=True)
    resource_name = Column(String, index=True)
    discipline = Column(String)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    allocation_percentage = Column(Integer, default=0)
    week_starting = Column(Date, index=True)

    project = relationship("Project")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, index=True)
    customer = Column(String)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    milestone_id = Column(Integer, ForeignKey("project_milestones.id"), nullable=True)
    status = Column(String)                       # paid | sent | overdue | draft | partially_paid
    business_unit = Column(String)
    total_amount = Column(Float, default=0.0)
    balance_due = Column(Float, default=0.0)
    invoice_date = Column(DateTime)
    due_date = Column(DateTime)


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, index=True)
    category = Column(String)
    vendor = Column(String)
    business_unit = Column(String)
    amount = Column(Float, default=0.0)
    expense_date = Column(DateTime)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)


class HeadcountRecord(Base):
    __tablename__ = "headcount_records"

    id = Column(Integer, primary_key=True, index=True)
    department = Column(String)
    month = Column(Date, index=True)
    headcount = Column(Integer, default=0)
    joiners = Column(Integer, default=0)
    leavers = Column(Integer, default=0)


class SystemUsageEvent(Base):
    """Software-usage telemetry from the connected systems.

    Feeds the security-side anomaly rules: failed login bursts, off-hours or
    out-of-geography access, bulk deletes, permission changes, closed-period edits.
    """

    __tablename__ = "system_usage_events"

    id = Column(Integer, primary_key=True, index=True)
    at = Column(DateTime, default=utcnow, index=True)
    user_email = Column(String, index=True)
    # login_failed | login_success | record_deleted | permission_changed | record_edited
    event_type = Column(String, index=True)
    system = Column(String)
    ip_address = Column(String)
    country = Column(String)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    record_count = Column(Integer, default=1)
    # Set when the edited record belongs to an accounting period already closed.
    period_closed = Column(Boolean, default=False)
    details = Column(JSON, default=dict)
