"""Report templates, schedules and generated runs."""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy.orm import Session

import database
import models
import schemas
from routers import serializers
from services import approvals, calendar_rules, rbac, report_engine
from deps import get_principal

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _get_template(db: Session, template_id: int) -> models.ReportTemplate:
    template = db.get(models.ReportTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Report template not found.")
    return template


def _get_run(db: Session, run_id: int) -> models.ReportRun:
    run = db.get(models.ReportRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Report run not found.")
    return run


@router.get("/schedules")
def list_schedules(
    cadence: str | None = Query(default=None),
    status: str | None = Query(default=None),
    team: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    query = db.query(models.ReportTemplate)
    if cadence and cadence != "all":
        query = query.filter(models.ReportTemplate.cadence == cadence)
    if search:
        query = query.filter(models.ReportTemplate.name.ilike(f"%{search}%"))

    items = []
    for template in query.order_by(models.ReportTemplate.cadence, models.ReportTemplate.name).all():
        if not principal.can_read(template.module):
            continue
        if team and team != "all" and (not template.owner_team or template.owner_team.name != team):
            continue
        last_run = (
            db.query(models.ReportRun)
            .filter(models.ReportRun.template_id == template.id)
            .order_by(models.ReportRun.generated_at.desc())
            .first()
        )
        payload = serializers.template(template, last_run=last_run)
        if status and status != "all":
            current = (last_run.status if last_run else "scheduled")
            if current != status:
                continue
        items.append(payload)
    return items


@router.get("/schedules/overview")
def schedules_overview(
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    templates = [
        t for t in db.query(models.ReportTemplate).all() if principal.can_read(t.module)
    ]
    runs = db.query(models.ReportRun).all()
    today = models.utcnow().date()
    sent_today = [
        r for r in runs if r.published_at and r.published_at.date() == today
    ]
    month_runs = [
        r for r in runs
        if r.generated_at and r.generated_at.month == models.utcnow().month
    ]
    delivered = [r for r in month_runs if r.delivery_status == "delivered"]
    failed = [r for r in month_runs if r.delivery_status == "failed" or r.status == "failed"]

    by_cadence: dict[str, int] = {}
    for template in templates:
        by_cadence[template.cadence] = by_cadence.get(template.cadence, 0) + 1

    upcoming = sorted(
        [t for t in templates if t.next_run_at],
        key=lambda t: t.next_run_at,
    )[:6]

    return {
        "scheduled": len(templates),
        "active": len([t for t in templates if t.is_active]),
        "sent_today": len(sent_today),
        "on_time_delivery_pct": round(
            len(delivered) / len(month_runs) * 100, 1
        ) if month_runs else 0.0,
        "failed_or_skipped": len(failed),
        "delivered_this_month": len(delivered),
        "avg_generation_seconds": round(
            sum(r.generation_ms or 0 for r in month_runs) / len(month_runs) / 1000, 2
        ) if month_runs else 0.0,
        "by_cadence": [{"cadence": k, "count": v} for k, v in by_cadence.items()],
        "by_team": _by_team(templates),
        "upcoming": [
            {
                "id": t.id,
                "name": t.name,
                "cadence": t.cadence,
                "next_run_at": t.next_run_at.isoformat(),
                "team": t.owner_team.name if t.owner_team else None,
            }
            for t in upcoming
        ],
    }


def _by_team(templates: list[models.ReportTemplate]) -> list[dict]:
    counts: dict[str, int] = {}
    for template in templates:
        name = template.owner_team.name if template.owner_team else "Unassigned"
        counts[name] = counts.get(name, 0) + 1
    return sorted(
        [{"team": k, "count": v} for k, v in counts.items()],
        key=lambda row: row["count"],
        reverse=True,
    )


@router.post("/schedules")
def create_schedule(
    body: schemas.TemplateRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rbac.assert_can(principal, "generate")
    if not body.code or not body.name:
        raise HTTPException(status_code=422, detail="code and name are required.")
    if body.cadence not in calendar_rules.CADENCES:
        raise HTTPException(
            status_code=422,
            detail=f"cadence must be one of {', '.join(calendar_rules.CADENCES)}.",
        )
    if db.query(models.ReportTemplate).filter(models.ReportTemplate.code == body.code).first():
        raise HTTPException(status_code=409, detail="A template with that code already exists.")

    template = models.ReportTemplate(
        code=body.code,
        name=body.name,
        description=body.description or "",
        module=body.module or "all",
        cadence=body.cadence,
        delivery_hour=body.delivery_hour if body.delivery_hour is not None else 7,
        sections=body.sections or [],
        thresholds=body.thresholds or {},
        default_comparison=body.default_comparison or "prior_period",
        owner_team_id=body.owner_team_id,
        reviewer_team_id=body.reviewer_team_id,
        escalation_team_id=body.escalation_team_id,
        escalation_after_hours=body.escalation_after_hours or 24,
        recipients=body.recipients or [],
    )
    template.next_run_at = calendar_rules.next_run_at(
        template.cadence, models.utcnow(), template.delivery_hour
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return serializers.template(template)


@router.patch("/schedules/{template_id}")
def update_schedule(
    template_id: int,
    body: schemas.TemplateRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rbac.assert_can(principal, "generate")
    template = _get_template(db, template_id)

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "code" or value is None:
            continue
        if field == "cadence" and value not in calendar_rules.CADENCES:
            raise HTTPException(status_code=422, detail="Unknown cadence.")
        setattr(template, field, value)

    template.next_run_at = calendar_rules.next_run_at(
        template.cadence, models.utcnow(), template.delivery_hour
    )
    db.commit()
    db.refresh(template)
    return serializers.template(template)


@router.post("/schedules/{template_id}/run")
def run_now(
    template_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rbac.assert_can(principal, "generate")
    template = _get_template(db, template_id)
    rbac.assert_can_read_module(principal, template.module)
    run = report_engine.generate_run(
        db, template, actor_email=principal.email, actor_role=principal.role
    )
    return serializers.run(run, include_content=False)


@router.get("/runs")
def list_runs(
    status: str | None = Query(default=None),
    template_id: int | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    query = db.query(models.ReportRun)
    if status and status != "all":
        query = query.filter(models.ReportRun.status == status)
    if template_id:
        query = query.filter(models.ReportRun.template_id == template_id)
    runs = query.order_by(models.ReportRun.generated_at.desc()).limit(limit).all()
    return [
        serializers.run(r, include_content=False)
        for r in runs
        if r.template and principal.can_read(r.template.module)
    ]


@router.get("/runs/{run_id}")
def get_run(
    run_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    """Serving the content is what records that a reviewer opened the report."""
    run = _get_run(db, run_id)
    if run.template:
        rbac.assert_can_read_module(principal, run.template.module)
    approvals.mark_opened(db, run, principal)
    return serializers.run(run)


@router.get("/runs/{run_id}/export.html", response_class=HTMLResponse)
def export_html(
    run_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    run = _get_run(db, run_id)
    if run.template:
        rbac.assert_can_read_module(principal, run.template.module)
    return HTMLResponse(report_engine.export_html(run))


@router.get("/runs/{run_id}/export.csv")
def export_csv(
    run_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    run = _get_run(db, run_id)
    if run.template:
        rbac.assert_can_read_module(principal, run.template.module)
    rows = report_engine.export_rows(run)
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=[
            "section", "metric", "value", "unit", "comparison_period",
            "comparison_value", "change_pct", "source_records",
        ],
    )
    writer.writeheader()
    writer.writerows(rows)
    buffer.seek(0)
    filename = f"{run.template.code if run.template else 'report'}-{run.period_label}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/metrics")
def metric_catalog(principal: rbac.Principal = Depends(get_principal)):
    """The metrics a template author can put in a section."""
    from services import metrics as metric_registry

    return [
        {
            "key": m.key,
            "label": m.label,
            "module": m.module,
            "unit": m.unit,
            "description": m.description,
            "dimensions": list(m.dimensions.keys()),
            "readable": principal.can_read(m.module),
        }
        for m in metric_registry.REGISTRY.values()
    ]
