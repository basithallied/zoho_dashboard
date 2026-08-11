"""Chat with data.

A question is resolved to a metric, a period and (optionally) a breakdown
dimension, then answered from the metric registry — the same code path the
scheduled reports use, so a number in chat and the same number in a report
cannot disagree.

Three behaviours the BRD calls for are implemented as hard rules rather than
prompt instructions:

* every figure carries the records behind it (`sources`);
* a question the agent cannot resolve returns `needs_clarification` instead of
  a guess;
* a metric outside the caller's permitted modules is refused explicitly, and
  the refusal says so rather than quietly returning nothing.
"""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

import models
from services import audit, metrics
from services.calendar_rules import Period, named_period
from services.rbac import Principal

PERIOD_PHRASES = (
    "month to date", "year to date", "last 90 days", "last 30 days", "last 7 days",
    "this quarter", "last quarter", "previous quarter", "this month", "last month",
    "previous month", "this year", "last year", "previous year", "yesterday", "today",
    "past week", "last week", "past 30 days", "past 90 days",
)

DIMENSION_PHRASES = {
    "business unit": ("business unit", "business units", "bu", "division", "divisions", "segment", "segments"),
    "customer": ("customer", "customers", "client", "clients", "account", "accounts"),
    "owner": ("owner", "owners", "sales rep", "sales reps", "rep", "salesperson", "manager", "managers"),
    "category": ("category", "categories", "expense type"),
    "status": ("status", "statuses"),
    "stage": ("stage", "stages"),
    "vendor": ("vendor", "vendors", "supplier", "suppliers"),
    "source": ("lead source", "lead sources", "channel", "channels", "source", "sources"),
    "department": ("department", "departments", "team", "teams"),
}

FOLLOW_UP_MARKERS = ("that", "those", "it", "the same", "instead", "now ")
COMPARE_MARKERS = ("vs", "versus", "compare", "against", "compared to")
TREND_MARKERS = ("trend", "over time", "by month", "monthly", "movement")


def _detect_period(text: str, as_of) -> tuple[Period | None, bool]:
    for phrase in PERIOD_PHRASES:
        if phrase in text:
            period = named_period(phrase, as_of)
            if period:
                return period, True
    match = re.search(r"\b(20\d{2})\b", text)
    if match:
        period = named_period("this year", as_of)
        if period:
            year = int(match.group(1))
            start = period.start.replace(year=year, month=1, day=1)
            end = start.replace(year=year + 1)
            return Period(start, end, str(year), "custom"), True
    return None, False


def _detect_dimension(text: str, metric: metrics.Metric | None) -> str | None:
    if not re.search(r"\b(by|per|split|breakdown|break down|across|top)\b", text):
        return None
    for canonical, phrases in DIMENSION_PHRASES.items():
        for phrase in phrases:
            if re.search(rf"\b{re.escape(phrase)}\b", text):
                if metric is None or canonical in metric.dimensions:
                    return canonical
    return None


def _is_follow_up(text: str) -> bool:
    return any(marker in text for marker in FOLLOW_UP_MARKERS)


def _kpi_entry(result: metrics.MetricResult, comparison: metrics.MetricResult | None) -> dict:
    entry = {
        "key": result.key,
        "label": result.label,
        "value": round(result.value, 2),
        "formatted": result.formatted,
        "unit": result.unit,
        "period": result.period_label,
        "record_count": result.record_count,
    }
    if comparison is not None:
        entry["comparison_label"] = comparison.period_label
        entry["comparison_formatted"] = comparison.formatted
        if comparison.value:
            change = (result.value - comparison.value) / abs(comparison.value) * 100
            entry["change_pct"] = round(change, 1)
            entry["direction"] = "up" if change > 0 else "down" if change < 0 else "flat"
            entry["favourable"] = (change >= 0) == result.higher_is_better
    return entry


def _clarification(question: str, principal: Principal, reason: str) -> dict:
    available = metrics.for_modules(principal.modules)
    suggestions = [
        {"key": m.key, "label": m.label, "module": m.module, "description": m.description}
        for m in available[:8]
    ]
    return {
        "answer": reason,
        "needs_clarification": True,
        "confidence": "low",
        "kpis": [],
        "chart": None,
        "table": None,
        "sources": [],
        "suggestions": suggestions,
        "question": question,
        "limits": [
            "The agent answers from defined metrics only. If the metric you need is "
            "missing, it has to be added to the registry rather than inferred."
        ],
    }


def answer(
    db: Session,
    principal: Principal,
    question: str,
    conversation: models.Conversation | None = None,
    *,
    as_of=None,
) -> dict:
    as_of = as_of or models.utcnow()
    text = (question or "").strip().lower()
    context = dict((conversation.context if conversation else None) or {})

    if not text:
        return _clarification(question, principal, "Ask a question about your data to get started.")

    # --- metric ------------------------------------------------------------
    allowed = list(principal.modules)
    candidates = metrics.find_by_phrase(text, allowed)
    metric = candidates[0] if candidates else None

    if metric is None:
        # Did they ask for something real that their role cannot see?
        blocked = metrics.find_by_phrase(text, None)
        if blocked:
            denied = blocked[0]
            return {
                **_clarification(
                    question,
                    principal,
                    f"{denied.label} sits in the {denied.module} module, which your role "
                    f"({principal.role}) is not permitted to read. Ask an administrator to "
                    f"extend your team's scope.",
                ),
                "permission_denied": True,
            }
        if _is_follow_up(text) and context.get("metric"):
            metric = metrics.get(context["metric"])

    if metric is None:
        return _clarification(
            question,
            principal,
            "I could not match that question to a defined metric, so I am not going to "
            "guess. Tell me which measure you mean and I will pull it with its sources.",
        )

    # Ambiguous when two candidates score closely and neither was named outright.
    ambiguous = len(candidates) > 1 and metric.label.lower() not in text

    # --- period ------------------------------------------------------------
    period, explicit_period = _detect_period(text, as_of)
    if period is None and _is_follow_up(text) and context.get("period_name"):
        period = named_period(context["period_name"], as_of)
        explicit_period = True
    if period is None:
        period = named_period("this month", as_of)

    # --- dimension ---------------------------------------------------------
    dimension = _detect_dimension(text, metric)
    wants_comparison = any(marker in text for marker in COMPARE_MARKERS)
    wants_trend = any(marker in text for marker in TREND_MARKERS)

    # --- compute -----------------------------------------------------------
    result = metric.compute(db, period)
    comparison = None
    if wants_comparison or not dimension:
        candidate = metric.compute(db, period.previous())
        # An as-of figure (open pipeline, overdue balance) returns the same
        # number for any window, so a "vs last month" line would be a lie.
        if candidate.period_label != result.period_label:
            comparison = candidate

    kpis = [_kpi_entry(result, comparison)]
    if comparison is not None and wants_comparison:
        kpis.append({
            "key": f"{metric.key}_prior",
            "label": f"{metric.label} ({comparison.period_label})",
            "value": round(comparison.value, 2),
            "formatted": comparison.formatted,
            "unit": metric.unit,
            "period": comparison.period_label,
            "record_count": comparison.record_count,
        })

    table = None
    chart = None
    rows: list[dict] = []

    if dimension:
        rows = metrics.breakdown(db, metric, period, dimension)
        if rows:
            total = sum(r["value"] for r in rows) or 1.0
            table = {
                "columns": [dimension.title(), metric.label, "Share", "Records"],
                "rows": [
                    [
                        r["label"],
                        metrics.format_value(r["value"], metric.unit),
                        f"{r['value'] / total * 100:.1f}%",
                        r["records"],
                    ]
                    for r in rows
                ],
            }
            chart = {
                "type": "bar",
                "title": f"{metric.label} by {dimension}",
                "series": [{"label": r["label"], "value": r["value"]} for r in rows[:10]],
            }
        else:
            dimension = None

    if chart is None:
        points = metrics.series(db, metric, period)
        if points:
            chart = {
                "type": "line" if wants_trend or len(points) > 4 else "bar",
                "title": f"{metric.label} — {period.label}",
                "series": points,
            }

    if table is None:
        summary_rows = [[
            period.label,
            metrics.format_value(result.value, metric.unit),
            str(result.record_count),
        ]]
        if comparison is not None:
            summary_rows.append([
                comparison.period_label,
                metrics.format_value(comparison.value, metric.unit),
                str(comparison.record_count),
            ])
            if comparison.value:
                change = result.value - comparison.value
                summary_rows.append([
                    "Change",
                    metrics.format_value(change, metric.unit),
                    f"{change / abs(comparison.value) * 100:+.1f}%",
                ])
        table = {"columns": ["Period", metric.label, "Records"], "rows": summary_rows}

    # --- narrative ---------------------------------------------------------
    sentences = [f"{metric.label} for {period.label} is {result.formatted}."]
    if comparison is not None and comparison.value:
        change = (result.value - comparison.value) / abs(comparison.value) * 100
        direction = "up" if change > 0 else "down" if change < 0 else "unchanged"
        sentences.append(
            f"That is {direction} {abs(change):.1f}% against {comparison.period_label} "
            f"({comparison.formatted})."
        )
    if dimension and rows:
        leader = rows[0]
        share = leader["value"] / (sum(r["value"] for r in rows) or 1) * 100
        sentences.append(
            f"{leader['label']} is the largest {dimension} at "
            f"{metrics.format_value(leader['value'], metric.unit)} ({share:.0f}% of the total)."
        )
    sentences.append(
        f"Computed from {result.record_count} source record(s); open any figure to see them."
    )

    confidence = "high"
    if ambiguous:
        confidence = "medium"
    if not explicit_period:
        confidence = "medium" if confidence == "high" else "low"
    if result.record_count == 0:
        confidence = "low"
        sentences.insert(
            0,
            "No source records matched this question for the period, so the figure below is zero "
            "rather than an estimate.",
        )

    limits = []
    if not explicit_period:
        limits.append(f"No period was given, so this covers {period.label}.")
    if comparison is not None and _is_partial(period):
        limits.append(
            f"{period.label} is still in progress, so it is being compared against a "
            "complete prior period."
        )
    if metric.as_of and comparison is None:
        limits.append("This is a position as of today, not a figure for the period.")
    if ambiguous:
        limits.append(
            "Several metrics matched the wording; I used "
            f"{metric.label}. Others available: "
            + ", ".join(m.label for m in candidates[1:4])
            + "."
        )
    if result.note:
        limits.append(result.note)

    payload = {
        "answer": " ".join(sentences),
        "needs_clarification": False,
        "confidence": confidence,
        "metric": metric.key,
        "module": metric.module,
        "period": period.label,
        "kpis": kpis,
        "chart": chart,
        "table": table,
        "sources": result.source_refs,
        "query_description": result.query_description,
        "limits": limits,
        "suggestions": _next_questions(metric, dimension),
    }

    if conversation is not None:
        conversation.context = {
            "metric": metric.key,
            "period_name": _period_name(text, period),
            "dimension": dimension,
            "module": metric.module,
        }
        conversation.updated_at = models.utcnow()

    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="chat.answered",
        entity_type="conversation",
        entity_id=conversation.id if conversation else "adhoc",
        summary=f"Answered: {question[:120]}",
        details={
            "metric": metric.key,
            "module": metric.module,
            "period": period.label,
            "confidence": confidence,
            "records": result.record_count,
        },
        commit=False,
    )
    db.commit()
    return payload


def _is_partial(period: Period) -> bool:
    """True when the window has not closed yet — month-to-date and friends."""
    import datetime

    return period.end.date() > datetime.date.today()


def _period_name(text: str, period: Period) -> str:
    for phrase in PERIOD_PHRASES:
        if phrase in text:
            return phrase
    return "this month" if period.grain == "month" else period.label


def _next_questions(metric: metrics.Metric, used_dimension: str | None) -> list[dict]:
    suggestions = []
    for dimension in metric.dimensions:
        if dimension == used_dimension:
            continue
        suggestions.append({"label": f"Split that by {dimension}", "question": f"now split that by {dimension}"})
    suggestions.append({"label": "Compare to last month", "question": f"{metric.label} this month vs last month"})
    suggestions.append({"label": "Show the trend", "question": f"{metric.label} trend over the last 90 days"})
    return suggestions[:4]
