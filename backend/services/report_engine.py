"""Report generation.

A run is built by walking the template's `sections`, resolving each metric
through the registry and attaching the comparison figure. The numbers come
from source records only. Commentary is written separately, from the numbers
that were already computed — `write_commentary` is the seam where a language
model plugs in, and it is never given the ability to change a figure.
"""

from __future__ import annotations

import datetime
import time

from sqlalchemy.orm import Session

import models
from services import audit, metrics
from services.calendar_rules import Period, next_run_at, period_for


def _comparison_period(period: Period, mode: str) -> Period | None:
    if mode == "prior_period":
        return period.previous()
    if mode == "prior_year":
        return period.previous_year()
    return None


def build_figures(db: Session, template: models.ReportTemplate, period: Period) -> tuple[dict, list[dict]]:
    """Compute every metric in the template. Returns (figures, source_refs)."""
    sections: list[dict] = []
    all_refs: list[dict] = []

    for section in template.sections or []:
        comparison_mode = section.get("comparison", template.default_comparison)
        comparison = _comparison_period(period, comparison_mode)
        rows = []

        for metric_key in section.get("metrics", []):
            metric = metrics.get(metric_key)
            if metric is None:
                rows.append({
                    "key": metric_key,
                    "label": metric_key,
                    "error": "metric is not defined in the registry",
                })
                continue

            result = metric.compute(db, period)
            entry = result.as_dict()

            if comparison is not None:
                prior = metric.compute(db, comparison)
                entry["comparison"] = {
                    "period": comparison.label,
                    "value": round(prior.value, 2),
                    "formatted": prior.formatted,
                }
                if prior.value:
                    change = (result.value - prior.value) / abs(prior.value) * 100
                    entry["comparison"]["change_pct"] = round(change, 1)
                    entry["comparison"]["direction"] = (
                        "up" if change > 0.05 else "down" if change < -0.05 else "flat"
                    )
                else:
                    entry["comparison"]["change_pct"] = None
                    entry["comparison"]["direction"] = "flat"

            entry["chart"] = metrics.series(db, metric, period)
            rows.append(entry)
            all_refs.extend(result.source_refs)

        sections.append({
            "key": section.get("key"),
            "title": section.get("title"),
            "comparison": comparison.label if comparison else None,
            "metrics": rows,
        })

    figures = {
        "period": period.label,
        "period_start": period.start.isoformat(),
        "period_end": period.end.isoformat(),
        "sections": sections,
    }
    # De-duplicate refs, keeping order.
    seen = set()
    unique_refs = []
    for ref in all_refs:
        token = (ref.get("entity_type"), ref.get("entity_id"))
        if token in seen:
            continue
        seen.add(token)
        unique_refs.append(ref)
    return figures, unique_refs


def write_commentary(figures: dict, thresholds: dict) -> dict:
    """Turn computed figures into prose.

    Deterministic today. When a language model is connected it receives exactly
    this input — the already-computed figures — and returns the same structure.
    It never queries the source systems itself, which is what keeps every number
    in a published report traceable.
    """
    notes: dict[str, list[str]] = {}
    highlights: list[str] = []
    concerns: list[str] = []

    for section in figures.get("sections", []):
        lines: list[str] = []
        for metric in section.get("metrics", []):
            if metric.get("error"):
                lines.append(f"{metric['label']}: not available — {metric['error']}.")
                continue

            label = metric["label"]
            formatted = metric["formatted"]
            comparison = metric.get("comparison")
            higher_is_better = metric.get("higher_is_better", True)

            if comparison and comparison.get("change_pct") is not None:
                change = comparison["change_pct"]
                direction = "up" if change > 0 else "down" if change < 0 else "flat"
                sentence = (
                    f"{label} is {formatted}, {direction} {abs(change):.1f}% "
                    f"against {comparison['period']} ({comparison['formatted']})."
                )
                favourable = (change >= 0) == higher_is_better
                if abs(change) >= 10:
                    (highlights if favourable else concerns).append(sentence)
            else:
                sentence = f"{label} is {formatted}."
            lines.append(sentence)

            threshold = thresholds.get(metric["key"])
            if threshold is not None:
                breached = (
                    metric["value"] > threshold if not higher_is_better
                    else metric["value"] < threshold
                )
                if breached:
                    breach = (
                        f"{label} breached its threshold of "
                        f"{metrics.format_value(threshold, metric['unit'])}."
                    )
                    lines.append(breach)
                    concerns.append(breach)

        notes[section["key"]] = lines

    return {
        "sections": notes,
        "highlights": highlights[:5],
        "concerns": concerns[:5],
        "written_by": "agent",
        "figures_source": "source records only — commentary does not compute values",
        "generated_at": models.utcnow().isoformat(),
    }


def generate_run(
    db: Session,
    template: models.ReportTemplate,
    *,
    actor_email: str,
    actor_role: str = "system",
    as_of: datetime.datetime | None = None,
    period: Period | None = None,
    submit_for_review: bool = True,
) -> models.ReportRun:
    """Generate one run and, by default, route it straight into team review."""
    started = time.perf_counter()
    as_of = as_of or models.utcnow()
    period = period or period_for(template.cadence, as_of)

    run = models.ReportRun(
        template_id=template.id,
        period_label=period.label,
        period_start=period.start,
        period_end=period.end,
        status="draft",
        generated_at=as_of,
    )

    try:
        figures, refs = build_figures(db, template, period)
        run.figures = figures
        run.source_refs = refs
        run.commentary = write_commentary(figures, template.thresholds or {})
    except Exception as exc:  # a failed run is a reportable event, not a crash
        run.status = "failed"
        run.delivery_status = "failed"
        run.delivery_error = f"{type(exc).__name__}: {exc}"

    run.generation_ms = int((time.perf_counter() - started) * 1000)
    db.add(run)
    db.flush()

    if run.status != "failed" and submit_for_review:
        _open_review(db, run, template)

    template.last_run_at = as_of
    template.next_run_at = next_run_at(template.cadence, as_of, template.delivery_hour)
    db.commit()
    db.refresh(run)

    audit.record(
        db,
        actor_email=actor_email,
        actor_role=actor_role,
        action="report.generated",
        entity_type="report_run",
        entity_id=run.id,
        summary=f"Generated {template.name} for {run.period_label}",
        details={
            "template": template.code,
            "status": run.status,
            "metrics": sum(len(s.get("metrics", [])) for s in (run.figures or {}).get("sections", [])),
            "source_records": len(run.source_refs or []),
            "generation_ms": run.generation_ms,
        },
    )
    return run


def _open_review(db: Session, run: models.ReportRun, template: models.ReportTemplate) -> None:
    run.status = "in_review"
    db.add(
        models.Approval(
            run_id=run.id,
            reviewer_team_id=template.reviewer_team_id,
            status="pending",
            requested_at=models.utcnow(),
        )
    )


def run_due_templates(db: Session, *, as_of: datetime.datetime | None = None) -> list[models.ReportRun]:
    """Generate every active template whose next run time has passed.

    The scheduler calls this; it is idempotent per period because a template's
    `next_run_at` is advanced as part of generation.
    """
    as_of = as_of or models.utcnow()
    due = (
        db.query(models.ReportTemplate)
        .filter(
            models.ReportTemplate.is_active.is_(True),
            models.ReportTemplate.next_run_at <= as_of,
        )
        .all()
    )
    return [
        generate_run(db, template, actor_email="scheduler@misagent.local", as_of=as_of)
        for template in due
    ]


def escalate_stale_reviews(db: Session, *, as_of: datetime.datetime | None = None) -> list[models.Approval]:
    """Move approvals past their SLA to the escalation team."""
    as_of = as_of or models.utcnow()
    escalated = []
    pending = (
        db.query(models.Approval)
        .filter(models.Approval.status == "pending", models.Approval.escalated_at.is_(None))
        .all()
    )
    for approval in pending:
        run = approval.run
        template = run.template if run else None
        if not template or not template.escalation_team_id:
            continue
        deadline = approval.requested_at + datetime.timedelta(hours=template.escalation_after_hours)
        if as_of >= deadline:
            approval.escalated_at = as_of
            approval.reviewer_team_id = template.escalation_team_id
            escalated.append(approval)
            audit.record(
                db,
                actor_email="scheduler@misagent.local",
                actor_role="system",
                action="report.escalated",
                entity_type="report_run",
                entity_id=run.id,
                summary=(
                    f"{template.name} for {run.period_label} escalated after "
                    f"{template.escalation_after_hours}h without a decision"
                ),
                commit=False,
            )
    if escalated:
        db.commit()
    return escalated


def export_html(run: models.ReportRun) -> str:
    """Interactive HTML is the delivery format; PDF/Excel export off the same payload."""
    template = run.template
    figures = run.figures or {}
    commentary = (run.commentary or {}).get("sections", {})
    parts = [
        "<!doctype html><meta charset='utf-8'>",
        f"<title>{template.name} — {run.period_label}</title>",
        "<style>body{font-family:Inter,system-ui,sans-serif;margin:40px;color:#1e2233}"
        "h1{margin-bottom:4px}.muted{color:#6b7280}table{border-collapse:collapse;width:100%;margin:12px 0}"
        "th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e6e8f0}"
        "th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280}"
        ".note{background:#f6f7fb;border-left:3px solid #4f46e5;padding:10px 14px;margin:10px 0}</style>",
        f"<h1>{template.name}</h1>",
        f"<p class='muted'>{run.period_label} &middot; status: {run.status} &middot; "
        f"{len(run.source_refs or [])} source records</p>",
    ]
    for section in figures.get("sections", []):
        parts.append(f"<h2>{section['title']}</h2>")
        parts.append("<table><tr><th>Metric</th><th>Value</th><th>Comparison</th></tr>")
        for metric in section.get("metrics", []):
            comparison = metric.get("comparison") or {}
            change = comparison.get("change_pct")
            change_text = f"{change:+.1f}% vs {comparison.get('period')}" if change is not None else "—"
            parts.append(
                f"<tr><td>{metric.get('label')}</td><td>{metric.get('formatted', '—')}</td>"
                f"<td>{change_text}</td></tr>"
            )
        parts.append("</table>")
        for line in commentary.get(section["key"], []):
            parts.append(f"<div class='note'>{line}</div>")
    return "".join(parts)


def export_rows(run: models.ReportRun) -> list[dict]:
    """Flat rows for the Excel/CSV export."""
    rows = []
    for section in (run.figures or {}).get("sections", []):
        for metric in section.get("metrics", []):
            comparison = metric.get("comparison") or {}
            rows.append({
                "section": section.get("title"),
                "metric": metric.get("label"),
                "value": metric.get("value"),
                "unit": metric.get("unit"),
                "comparison_period": comparison.get("period"),
                "comparison_value": comparison.get("value"),
                "change_pct": comparison.get("change_pct"),
                "source_records": metric.get("record_count"),
            })
    return rows
