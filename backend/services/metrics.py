"""Metric registry.

Every number the agent shows — in a scheduled report, on the dashboard or in a
chat answer — is produced here, from source records. Nothing downstream is
allowed to invent a figure; the agent writes commentary about these values but
never the values themselves.

Each result carries `source_refs`, the rows the number was computed from, so a
reader can open the records behind any figure.
"""

from __future__ import annotations

import datetime
import re
from dataclasses import dataclass, field
from typing import Callable, Iterable, Sequence

from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from services.calendar_rules import Period

MAX_REFS = 50


@dataclass
class MetricResult:
    key: str
    label: str
    module: str
    unit: str
    value: float
    period_label: str
    record_count: int = 0
    source_refs: list[dict] = field(default_factory=list)
    query_description: str = ""
    higher_is_better: bool = True
    note: str | None = None

    @property
    def formatted(self) -> str:
        return format_value(self.value, self.unit)

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "module": self.module,
            "unit": self.unit,
            "value": round(self.value, 2),
            "formatted": self.formatted,
            "period": self.period_label,
            "record_count": self.record_count,
            "source_refs": self.source_refs[:MAX_REFS],
            "query_description": self.query_description,
            "higher_is_better": self.higher_is_better,
            "note": self.note,
        }


def format_value(value: float, unit: str) -> str:
    if unit == "SAR":
        return f"SAR {value:,.0f}"
    if unit == "%":
        return f"{value:,.1f}%"
    if unit == "days":
        return f"{value:,.1f} days"
    if value == int(value):
        return f"{int(value):,}"
    return f"{value:,.2f}"


@dataclass
class Metric:
    key: str
    label: str
    module: str
    unit: str
    synonyms: tuple[str, ...]
    description: str
    compute: Callable[[Session, Period], MetricResult]
    dimensions: dict[str, str] = field(default_factory=dict)
    as_of: bool = False
    higher_is_better: bool = True


REGISTRY: dict[str, Metric] = {}


def register(metric: Metric) -> Metric:
    REGISTRY[metric.key] = metric
    return metric


def get(key: str) -> Metric | None:
    return REGISTRY.get(key)


def for_modules(modules: Iterable[str]) -> list[Metric]:
    allowed = set(modules)
    return [m for m in REGISTRY.values() if m.module in allowed]


# ---------------------------------------------------------------------------
# Generic aggregation
# ---------------------------------------------------------------------------

def _ref(model_name: str, row_id, label: str, amount: float | None = None) -> dict:
    ref = {"entity_type": model_name, "entity_id": str(row_id), "label": label}
    if amount is not None:
        ref["amount"] = round(amount, 2)
    return ref


def aggregate(
    db: Session,
    *,
    model,
    period: Period,
    value_attr: str | None,
    date_attr: str | None,
    label_attr: str,
    filters: Sequence = (),
    agg: str = "sum",
    as_of: bool = False,
) -> tuple[float, int, list[dict]]:
    """Run one aggregation and collect the rows behind it."""
    query = db.query(model)
    for criterion in filters:
        query = query.filter(criterion)
    if not as_of and date_attr:
        column = getattr(model, date_attr)
        query = query.filter(column >= period.start, column < period.end)

    rows = query.all()
    if value_attr is None:
        value = float(len(rows))
    elif agg == "avg":
        values = [float(getattr(r, value_attr) or 0.0) for r in rows]
        value = sum(values) / len(values) if values else 0.0
    else:
        value = float(sum(float(getattr(r, value_attr) or 0.0) for r in rows))

    refs = []
    ordered = rows
    if value_attr:
        ordered = sorted(rows, key=lambda r: float(getattr(r, value_attr) or 0.0), reverse=True)
    for row in ordered[:MAX_REFS]:
        refs.append(
            _ref(
                model.__name__,
                getattr(row, "source_id", None) or row.id,
                str(getattr(row, label_attr, "") or f"{model.__name__} #{row.id}"),
                float(getattr(row, value_attr) or 0.0) if value_attr else None,
            )
        )
    return value, len(rows), refs


def _simple_metric(
    *,
    key: str,
    label: str,
    module: str,
    unit: str,
    synonyms: tuple[str, ...],
    description: str,
    model,
    value_attr: str | None,
    date_attr: str | None,
    label_attr: str,
    filters_factory: Callable[[], Sequence] = lambda: (),
    agg: str = "sum",
    as_of: bool = False,
    dimensions: dict[str, str] | None = None,
    higher_is_better: bool = True,
) -> Metric:
    def compute(db: Session, period: Period) -> MetricResult:
        value, count, refs = aggregate(
            db,
            model=model,
            period=period,
            value_attr=value_attr,
            date_attr=date_attr,
            label_attr=label_attr,
            filters=filters_factory(),
            agg=agg,
            as_of=as_of,
        )
        return MetricResult(
            key=key,
            label=label,
            module=module,
            unit=unit,
            value=value,
            period_label="as of today" if as_of else period.label,
            record_count=count,
            source_refs=refs,
            query_description=(
                f"{agg}({value_attr or 'count'}) over {model.__tablename__}"
                + ("" if as_of else f" where {date_attr} in [{period.start:%Y-%m-%d}, {period.end:%Y-%m-%d})")
            ),
            higher_is_better=higher_is_better,
        )

    return register(
        Metric(
            key=key,
            label=label,
            module=module,
            unit=unit,
            synonyms=synonyms,
            description=description,
            compute=compute,
            dimensions=dimensions or {},
            as_of=as_of,
            higher_is_better=higher_is_better,
        )
    )


def _derived(
    *,
    key: str,
    label: str,
    module: str,
    unit: str,
    synonyms: tuple[str, ...],
    description: str,
    parents: tuple[str, ...],
    fn: Callable[[dict[str, MetricResult]], float],
    higher_is_better: bool = True,
    note: str | None = None,
) -> Metric:
    def compute(db: Session, period: Period) -> MetricResult:
        resolved = {p: REGISTRY[p].compute(db, period) for p in parents}
        value = fn(resolved)
        # Parents often share records (won value and won count read the same
        # deals), so the union has to be de-duplicated before it is shown.
        refs: list[dict] = []
        seen: set[tuple] = set()
        for parent in resolved.values():
            for ref in parent.source_refs:
                token = (ref.get("entity_type"), ref.get("entity_id"))
                if token in seen:
                    continue
                seen.add(token)
                refs.append(ref)
        return MetricResult(
            key=key,
            label=label,
            module=module,
            unit=unit,
            value=value,
            period_label=period.label,
            record_count=sum(p.record_count for p in resolved.values()),
            source_refs=refs[:MAX_REFS],
            query_description="derived from " + ", ".join(parents),
            higher_is_better=higher_is_better,
            note=note,
        )

    return register(
        Metric(
            key=key,
            label=label,
            module=module,
            unit=unit,
            synonyms=synonyms,
            description=description,
            compute=compute,
            higher_is_better=higher_is_better,
        )
    )


# ---------------------------------------------------------------------------
# Finance
# ---------------------------------------------------------------------------

_INVOICE_DIMENSIONS = {
    "business unit": "business_unit",
    "customer": "customer",
    "status": "status",
}

_simple_metric(
    key="revenue_invoiced",
    label="Revenue Invoiced",
    module="finance",
    unit="SAR",
    synonyms=("revenue", "sales", "total sales", "invoiced", "billings", "turnover", "income"),
    description="Value of invoices raised in the period, excluding drafts.",
    model=models.Invoice,
    value_attr="total_amount",
    date_attr="invoice_date",
    label_attr="source_id",
    filters_factory=lambda: (models.Invoice.status != "draft",),
    dimensions=_INVOICE_DIMENSIONS,
)

_simple_metric(
    key="collections",
    label="Collections",
    module="finance",
    unit="SAR",
    synonyms=("collected", "cash collected", "receipts", "paid invoices"),
    description="Invoiced value already settled, for invoices dated in the period.",
    model=models.Invoice,
    value_attr="total_amount",
    date_attr="invoice_date",
    label_attr="source_id",
    filters_factory=lambda: (models.Invoice.status == "paid",),
    dimensions=_INVOICE_DIMENSIONS,
)

_simple_metric(
    key="overdue_receivables",
    label="Overdue Receivables",
    module="finance",
    unit="SAR",
    synonyms=("overdue", "receivables", "outstanding", "debtors", "unpaid", "ar"),
    description="Balance due on invoices past their due date, as of today.",
    model=models.Invoice,
    value_attr="balance_due",
    date_attr="due_date",
    label_attr="source_id",
    filters_factory=lambda: (models.Invoice.status == "overdue",),
    as_of=True,
    dimensions=_INVOICE_DIMENSIONS,
    higher_is_better=False,
)

_simple_metric(
    key="expenses_total",
    label="Total Expenses",
    module="finance",
    unit="SAR",
    synonyms=("expenses", "expense", "spend", "costs", "cost", "expenditure", "opex"),
    description="Expenses booked in the period across all categories.",
    model=models.Expense,
    value_attr="amount",
    date_attr="expense_date",
    label_attr="vendor",
    dimensions={"category": "category", "vendor": "vendor", "business unit": "business_unit"},
    higher_is_better=False,
)

_simple_metric(
    key="unbilled_completed_work",
    label="Unbilled Completed Work",
    module="finance",
    unit="SAR",
    synonyms=("unbilled", "not invoiced", "wip", "work in progress"),
    description="Value of milestones at 100% completion with no invoice raised.",
    model=models.ProjectMilestone,
    value_attr="value",
    date_attr="actual_completion",
    label_attr="name",
    filters_factory=lambda: (
        models.ProjectMilestone.completion_percentage >= 100,
        models.ProjectMilestone.is_invoiced.is_(False),
    ),
    as_of=True,
    higher_is_better=False,
)

_derived(
    key="net_profit",
    label="Net Profit",
    module="finance",
    unit="SAR",
    synonyms=("profit", "bottom line", "net income"),
    description="Revenue invoiced less expenses booked in the period.",
    parents=("revenue_invoiced", "expenses_total"),
    fn=lambda m: m["revenue_invoiced"].value - m["expenses_total"].value,
    note="Gross of accruals — this is a management view, not a statutory P&L.",
)

_derived(
    key="net_margin",
    label="Net Margin",
    module="finance",
    unit="%",
    synonyms=("margin", "profit margin", "profitability"),
    description="Net profit as a share of revenue invoiced.",
    parents=("revenue_invoiced", "expenses_total"),
    fn=lambda m: (
        0.0
        if m["revenue_invoiced"].value == 0
        else (m["revenue_invoiced"].value - m["expenses_total"].value)
        / m["revenue_invoiced"].value * 100
    ),
)

_derived(
    key="dso",
    label="Days Sales Outstanding",
    module="finance",
    unit="days",
    synonyms=("dso", "days sales outstanding", "collection period"),
    description="Overdue receivables expressed as days of invoiced revenue.",
    parents=("overdue_receivables", "revenue_invoiced"),
    fn=lambda m: (
        0.0
        if m["revenue_invoiced"].value == 0
        else m["overdue_receivables"].value / m["revenue_invoiced"].value * 30
    ),
    higher_is_better=False,
    note="Approximated on a 30-day revenue basis.",
)

# ---------------------------------------------------------------------------
# CRM
# ---------------------------------------------------------------------------

_DEAL_DIMENSIONS = {
    "business unit": "business_unit",
    "owner": "owner",
    "customer": "customer",
    "stage": "stage",
}

OPEN_STAGES = ("qualification", "needs_analysis", "proposal", "negotiation")

_simple_metric(
    key="pipeline_value",
    label="Open Pipeline",
    module="crm",
    unit="SAR",
    synonyms=("pipeline", "open deals value", "opportunity value", "funnel value"),
    description="Value of deals not yet closed, as of today.",
    model=models.CRMDeal,
    value_attr="amount",
    date_attr="closing_date",
    label_attr="name",
    filters_factory=lambda: (models.CRMDeal.stage.in_(OPEN_STAGES),),
    as_of=True,
    dimensions=_DEAL_DIMENSIONS,
)

_simple_metric(
    key="deals_won_value",
    label="Won Deal Value",
    module="crm",
    unit="SAR",
    synonyms=("won", "closed won", "bookings", "orders won"),
    description="Value of deals closed won in the period.",
    model=models.CRMDeal,
    value_attr="amount",
    date_attr="closing_date",
    label_attr="name",
    filters_factory=lambda: (models.CRMDeal.stage == "closed_won",),
    dimensions=_DEAL_DIMENSIONS,
)

_simple_metric(
    key="deals_won_count",
    label="Deals Won",
    module="crm",
    unit="",
    synonyms=("number of deals won", "wins", "deal count"),
    description="Count of deals closed won in the period.",
    model=models.CRMDeal,
    value_attr=None,
    date_attr="closing_date",
    label_attr="name",
    filters_factory=lambda: (models.CRMDeal.stage == "closed_won",),
    dimensions=_DEAL_DIMENSIONS,
)

_simple_metric(
    key="deals_lost_count",
    label="Deals Lost",
    module="crm",
    unit="",
    synonyms=("losses", "closed lost"),
    description="Count of deals closed lost in the period.",
    model=models.CRMDeal,
    value_attr=None,
    date_attr="closing_date",
    label_attr="name",
    filters_factory=lambda: (models.CRMDeal.stage == "closed_lost",),
    higher_is_better=False,
    dimensions=_DEAL_DIMENSIONS,
)

_simple_metric(
    key="new_leads",
    label="New Leads",
    module="crm",
    unit="",
    synonyms=("leads", "enquiries", "lead count"),
    description="Leads created in the period.",
    model=models.CRMLead,
    value_attr=None,
    date_attr="created_at",
    label_attr="company",
    dimensions={"owner": "owner", "source": "lead_source", "business unit": "business_unit"},
)

_simple_metric(
    key="quotations_outstanding",
    label="Outstanding Quotations",
    module="crm",
    unit="SAR",
    synonyms=("quotations", "quotes", "proposals sent"),
    description="Value of quotations sent and not yet accepted or rejected.",
    model=models.CRMQuotation,
    value_attr="amount",
    date_attr="sent_at",
    label_attr="source_id",
    filters_factory=lambda: (models.CRMQuotation.status == "sent",),
    as_of=True,
    dimensions={"owner": "owner", "customer": "customer"},
)

_derived(
    key="win_rate",
    label="Win Rate",
    module="crm",
    unit="%",
    synonyms=("win rate", "conversion rate", "hit rate"),
    description="Deals won as a share of deals closed in the period.",
    parents=("deals_won_count", "deals_lost_count"),
    fn=lambda m: (
        0.0
        if (m["deals_won_count"].value + m["deals_lost_count"].value) == 0
        else m["deals_won_count"].value
        / (m["deals_won_count"].value + m["deals_lost_count"].value) * 100
    ),
)

_derived(
    key="avg_deal_size",
    label="Average Deal Size",
    module="crm",
    unit="SAR",
    synonyms=("average deal", "average order value", "aov", "deal size"),
    description="Won deal value divided by the number of deals won.",
    parents=("deals_won_value", "deals_won_count"),
    fn=lambda m: (
        0.0
        if m["deals_won_count"].value == 0
        else m["deals_won_value"].value / m["deals_won_count"].value
    ),
)

# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

_PROJECT_DIMENSIONS = {
    "business unit": "business_unit",
    "manager": "manager",
    "customer": "customer",
    "status": "status",
}

_simple_metric(
    key="active_projects",
    label="Active Projects",
    module="projects",
    unit="",
    synonyms=("projects", "ongoing projects", "live projects"),
    description="Projects currently in execution.",
    model=models.Project,
    value_attr=None,
    date_attr="start_date",
    label_attr="name",
    filters_factory=lambda: (models.Project.status == "in_progress",),
    as_of=True,
    dimensions=_PROJECT_DIMENSIONS,
)

_simple_metric(
    key="project_cost",
    label="Project Cost to Date",
    module="projects",
    unit="SAR",
    synonyms=("project cost", "actual cost", "cost to date"),
    description="Actual cost booked against active projects.",
    model=models.Project,
    value_attr="actual_cost",
    date_attr="start_date",
    label_attr="name",
    filters_factory=lambda: (models.Project.status == "in_progress",),
    as_of=True,
    higher_is_better=False,
    dimensions=_PROJECT_DIMENSIONS,
)

_simple_metric(
    key="project_budget",
    label="Approved Project Budget",
    module="projects",
    unit="SAR",
    synonyms=("budget", "approved budget"),
    description="Approved budget of active projects.",
    model=models.Project,
    value_attr="budget",
    date_attr="start_date",
    label_attr="name",
    filters_factory=lambda: (models.Project.status == "in_progress",),
    as_of=True,
    dimensions=_PROJECT_DIMENSIONS,
)

_simple_metric(
    key="milestones_completed",
    label="Milestones Completed",
    module="projects",
    unit="",
    synonyms=("milestones", "completed milestones"),
    description="Milestones reaching 100% in the period.",
    model=models.ProjectMilestone,
    value_attr=None,
    date_attr="actual_completion",
    label_attr="name",
    filters_factory=lambda: (models.ProjectMilestone.completion_percentage >= 100,),
)

_derived(
    key="budget_variance",
    label="Budget Variance",
    module="projects",
    unit="SAR",
    synonyms=("cost overrun", "budget overrun", "variance"),
    description="Actual cost less approved budget on active projects.",
    parents=("project_cost", "project_budget"),
    fn=lambda m: m["project_cost"].value - m["project_budget"].value,
    higher_is_better=False,
)


def _resource_utilization(db: Session, period: Period) -> MetricResult:
    rows = (
        db.query(
            models.ResourceAllocation.resource_name,
            func.sum(models.ResourceAllocation.allocation_percentage).label("total"),
        )
        .filter(
            models.ResourceAllocation.week_starting >= period.start.date(),
            models.ResourceAllocation.week_starting < period.end.date(),
        )
        .group_by(models.ResourceAllocation.resource_name)
        .all()
    )
    if not rows:
        rows = (
            db.query(
                models.ResourceAllocation.resource_name,
                func.avg(models.ResourceAllocation.allocation_percentage).label("total"),
            )
            .group_by(models.ResourceAllocation.resource_name)
            .all()
        )
    values = [float(r.total or 0) for r in rows]
    value = sum(values) / len(values) if values else 0.0
    refs = [
        _ref("ResourceAllocation", r.resource_name, r.resource_name, float(r.total or 0))
        for r in sorted(rows, key=lambda r: float(r.total or 0), reverse=True)[:MAX_REFS]
    ]
    return MetricResult(
        key="resource_utilization",
        label="Resource Utilisation",
        module="projects",
        unit="%",
        value=value,
        period_label=period.label,
        record_count=len(rows),
        source_refs=refs,
        query_description="avg of per-resource allocation % over resource_allocations",
    )


register(
    Metric(
        key="resource_utilization",
        label="Resource Utilisation",
        module="projects",
        unit="%",
        synonyms=("utilisation", "utilization", "resource load", "capacity"),
        description="Average allocation across resources in the period.",
        compute=_resource_utilization,
    )
)


def _on_time_delivery(db: Session, period: Period) -> MetricResult:
    projects = (
        db.query(models.Project)
        .filter(models.Project.status.in_(("in_progress", "completed")))
        .all()
    )
    if not projects:
        return MetricResult(
            key="on_time_delivery", label="On-Time Delivery", module="projects", unit="%",
            value=0.0, period_label=period.label,
        )
    on_time = [
        p for p in projects
        if p.forecast_end_date and p.baseline_end_date and p.forecast_end_date <= p.baseline_end_date
    ]
    late = [p for p in projects if p not in on_time]
    return MetricResult(
        key="on_time_delivery",
        label="On-Time Delivery",
        module="projects",
        unit="%",
        value=len(on_time) / len(projects) * 100,
        period_label="as of today",
        record_count=len(projects),
        source_refs=[
            _ref("Project", p.source_id, f"{p.name} (forecast slip)")
            for p in late[:MAX_REFS]
        ],
        query_description="projects where forecast_end_date <= baseline_end_date",
    )


register(
    Metric(
        key="on_time_delivery",
        label="On-Time Delivery",
        module="projects",
        unit="%",
        synonyms=("on time", "schedule performance", "delivery performance"),
        description="Share of projects forecast to finish on or before baseline.",
        compute=_on_time_delivery,
        as_of=True,
    )
)

# ---------------------------------------------------------------------------
# HR
# ---------------------------------------------------------------------------

def _headcount(db: Session, period: Period) -> MetricResult:
    rows = (
        db.query(models.HeadcountRecord)
        .filter(models.HeadcountRecord.month < period.end.date())
        .order_by(models.HeadcountRecord.month.desc())
        .all()
    )
    if not rows:
        return MetricResult("headcount", "Headcount", "hr", "", 0.0, period.label)
    latest_month = rows[0].month
    latest = [r for r in rows if r.month == latest_month]
    return MetricResult(
        key="headcount",
        label="Headcount",
        module="hr",
        unit="",
        value=float(sum(r.headcount for r in latest)),
        period_label=latest_month.strftime("%b %Y"),
        record_count=len(latest),
        source_refs=[
            _ref("HeadcountRecord", r.id, r.department, float(r.headcount)) for r in latest
        ],
        query_description="sum(headcount) over headcount_records for the latest closed month",
    )


register(
    Metric(
        key="headcount",
        label="Headcount",
        module="hr",
        unit="",
        synonyms=("headcount", "employees", "staff", "people"),
        description="Closing headcount for the latest month with data.",
        compute=_headcount,
        dimensions={"department": "department"},
        as_of=True,
    )
)


# ---------------------------------------------------------------------------
# Breakdowns and series
# ---------------------------------------------------------------------------

def breakdown(
    db: Session, metric: Metric, period: Period, dimension: str
) -> list[dict]:
    """Split a metric by one of its declared dimensions."""
    column_name = metric.dimensions.get(dimension)
    if not column_name:
        return []

    # Re-run the metric per distinct value of the dimension, so the split always
    # matches the headline number instead of drifting from a parallel query.
    model = _metric_model(metric)
    if model is None:
        return []
    column = getattr(model, column_name)
    values = [row[0] for row in db.query(column).distinct().all() if row[0]]

    results = []
    for value in values:
        original = getattr(model, column_name)
        rows = _filtered_rows(db, metric, period, original == value)
        if rows is None:
            continue
        total, count = rows
        if count == 0:
            continue
        results.append({"label": str(value), "value": round(total, 2), "records": count})
    results.sort(key=lambda r: r["value"], reverse=True)
    return results


_METRIC_MODELS = {
    "revenue_invoiced": (models.Invoice, "total_amount", "invoice_date", ("status", "!=", "draft")),
    "collections": (models.Invoice, "total_amount", "invoice_date", ("status", "==", "paid")),
    "overdue_receivables": (models.Invoice, "balance_due", None, ("status", "==", "overdue")),
    "expenses_total": (models.Expense, "amount", "expense_date", None),
    "pipeline_value": (models.CRMDeal, "amount", None, ("stage", "in", OPEN_STAGES)),
    "deals_won_value": (models.CRMDeal, "amount", "closing_date", ("stage", "==", "closed_won")),
    "deals_won_count": (models.CRMDeal, None, "closing_date", ("stage", "==", "closed_won")),
    "deals_lost_count": (models.CRMDeal, None, "closing_date", ("stage", "==", "closed_lost")),
    "new_leads": (models.CRMLead, None, "created_at", None),
    "quotations_outstanding": (models.CRMQuotation, "amount", None, ("status", "==", "sent")),
    "active_projects": (models.Project, None, None, ("status", "==", "in_progress")),
    "project_cost": (models.Project, "actual_cost", None, ("status", "==", "in_progress")),
    "project_budget": (models.Project, "budget", None, ("status", "==", "in_progress")),
    "headcount": (models.HeadcountRecord, "headcount", None, None),
}


def _metric_model(metric: Metric):
    entry = _METRIC_MODELS.get(metric.key)
    return entry[0] if entry else None


def _base_query(db: Session, metric: Metric, period: Period):
    entry = _METRIC_MODELS.get(metric.key)
    if not entry:
        return None, None
    model, value_attr, date_attr, condition = entry
    query = db.query(model)
    if condition:
        attr, op, operand = condition
        column = getattr(model, attr)
        if op == "==":
            query = query.filter(column == operand)
        elif op == "!=":
            query = query.filter(column != operand)
        elif op == "in":
            query = query.filter(column.in_(operand))
    if date_attr and not metric.as_of:
        column = getattr(model, date_attr)
        query = query.filter(column >= period.start, column < period.end)
    return query, value_attr


def _filtered_rows(db: Session, metric: Metric, period: Period, extra_filter):
    query, value_attr = _base_query(db, metric, period)
    if query is None:
        return None
    rows = query.filter(extra_filter).all()
    if value_attr is None:
        return float(len(rows)), len(rows)
    return float(sum(float(getattr(r, value_attr) or 0.0) for r in rows)), len(rows)


def series(db: Session, metric: Metric, period: Period, buckets: int = 12) -> list[dict]:
    """A time series for the metric across the period, bucketed by day or month."""
    entry = _METRIC_MODELS.get(metric.key)
    if not entry or entry[2] is None:
        return []
    model, value_attr, date_attr, _ = entry

    span_days = max((period.end - period.start).days, 1)
    by_month = span_days > 62
    edges: list[tuple[datetime.datetime, datetime.datetime, str]] = []

    if by_month:
        cursor = period.start.replace(day=1)
        while cursor < period.end:
            nxt = (cursor.replace(day=28) + datetime.timedelta(days=4)).replace(day=1)
            edges.append((cursor, min(nxt, period.end), cursor.strftime("%b %Y")))
            cursor = nxt
    else:
        step = max(span_days // buckets, 1)
        cursor = period.start
        while cursor < period.end:
            nxt = min(cursor + datetime.timedelta(days=step), period.end)
            edges.append((cursor, nxt, cursor.strftime("%d %b")))
            cursor = nxt

    points = []
    for start, end, label in edges:
        bucket = Period(start, end, label, period.grain)
        query, attr = _base_query(db, metric, bucket)
        if query is None:
            continue
        rows = query.all()
        value = float(len(rows)) if attr is None else float(
            sum(float(getattr(r, attr) or 0.0) for r in rows)
        )
        points.append({"label": label, "value": round(value, 2)})
    return points


def _contains_phrase(text: str, phrase: str) -> bool:
    """Whole-word containment.

    Substring matching is not good enough here: "ar" would match "year" and
    silently answer a question about expenses with receivables.
    """
    return re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", text) is not None


def find_by_phrase(phrase: str, allowed_modules: Sequence[str] | None = None) -> list[Metric]:
    """Rank registry entries against a natural-language phrase."""
    text = phrase.lower()
    scored: list[tuple[int, Metric]] = []
    for metric in REGISTRY.values():
        if allowed_modules is not None and metric.module not in allowed_modules:
            continue
        score = 0
        if _contains_phrase(text, metric.label.lower()):
            score += 10
        for synonym in metric.synonyms:
            if _contains_phrase(text, synonym):
                score += 6 + len(synonym.split())
        key_words = metric.key.replace("_", " ")
        if _contains_phrase(text, key_words):
            score += 8
        if score:
            scored.append((score, metric))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [metric for _, metric in scored]
