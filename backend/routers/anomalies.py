"""Anomaly list, detail, triage and rule tuning."""

from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import database
import models
import schemas
from deps import get_principal
from routers import serializers
from services import anomaly_engine, rbac

router = APIRouter(prefix="/api/anomalies", tags=["anomalies"])

SEVERITIES = ("high", "medium", "low", "info")


def _visible(query, principal: rbac.Principal):
    return query.filter(models.Anomaly.module.in_(principal.modules))


@router.get("")
def list_anomalies(
    status: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    module: str | None = Query(default=None),
    domain: str | None = Query(default=None),
    days: int = Query(default=90, le=365),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    since = models.utcnow() - datetime.timedelta(days=days)
    query = _visible(db.query(models.Anomaly), principal).filter(
        models.Anomaly.detected_at >= since
    )
    if status and status != "all":
        query = query.filter(models.Anomaly.status == status)
    if severity and severity != "all":
        query = query.filter(models.Anomaly.severity == severity)
    if module and module != "all":
        query = query.filter(models.Anomaly.module == module)
    if domain and domain != "all":
        query = query.filter(models.Anomaly.domain == domain)

    rows = (
        query.order_by(models.Anomaly.detected_at.desc(), models.Anomaly.id.desc())
        .limit(limit)
        .all()
    )
    return [serializers.anomaly(row, include_detail=False) for row in rows]


@router.get("/summary")
def summary(
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rows = _visible(db.query(models.Anomaly), principal).all()
    now = models.utcnow()
    this_month = [r for r in rows if r.detected_at and r.detected_at.month == now.month]
    resolved_this_month = [
        r for r in rows
        if r.status == "resolved" and r.resolved_at and r.resolved_at.month == now.month
    ]
    rules = db.query(models.AnomalyRule).all()
    detections = sum(r.detections or 0 for r in rules)
    false_positives = sum(r.false_positives or 0 for r in rules)

    by_severity = [
        {
            "severity": severity,
            "count": len([r for r in rows if r.severity == severity and r.status == "active"]),
        }
        for severity in SEVERITIES
    ]
    by_module: dict[str, int] = {}
    for row in rows:
        if row.status in ("active", "investigating"):
            by_module[row.module] = by_module.get(row.module, 0) + 1

    over_time = []
    for offset in range(6, -1, -1):
        day = (now - datetime.timedelta(days=offset)).date()
        over_time.append({
            "label": day.strftime("%d %b"),
            "count": len([r for r in rows if r.detected_at and r.detected_at.date() == day]),
        })

    top_entities: dict[str, dict] = {}
    for row in rows:
        if row.status not in ("active", "investigating") or not row.entity_label:
            continue
        entry = top_entities.setdefault(
            row.entity_label, {"label": row.entity_label, "count": 0, "severity": "low"}
        )
        entry["count"] += 1
        if anomaly_engine.SEVERITY_ORDER.get(row.severity, 0) > anomaly_engine.SEVERITY_ORDER.get(
            entry["severity"], 0
        ):
            entry["severity"] = row.severity

    last_scan = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.action == "anomaly.scan")
        .order_by(models.AuditLog.at.desc())
        .first()
    )

    return {
        "active": len([r for r in rows if r.status == "active"]),
        "investigating": len([r for r in rows if r.status == "investigating"]),
        "this_month": len(this_month),
        "resolved_this_month": len(resolved_this_month),
        "false_positive_rate": round(false_positives / detections * 100, 1) if detections else 0.0,
        "total_impact": round(
            sum(r.financial_impact or 0 for r in rows if r.status in ("active", "investigating")), 2
        ),
        "by_severity": by_severity,
        "by_module": sorted(
            [{"module": k, "count": v} for k, v in by_module.items()],
            key=lambda row: row["count"],
            reverse=True,
        ),
        "over_time": over_time,
        "top_entities": sorted(
            top_entities.values(), key=lambda row: row["count"], reverse=True
        )[:5],
        "last_scan_at": last_scan.at.isoformat() if last_scan else None,
    }


@router.get("/{anomaly_id}")
def get_anomaly(
    anomaly_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    row = db.get(models.Anomaly, anomaly_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Anomaly not found.")
    rbac.assert_can_read_module(principal, row.module)
    payload = serializers.anomaly(row)
    rule = (
        db.query(models.AnomalyRule)
        .filter(models.AnomalyRule.code == row.rule_code)
        .first()
    )
    payload["rule"] = serializers.rule(rule) if rule else None
    return payload


@router.patch("/{anomaly_id}/status")
def set_status(
    anomaly_id: int,
    body: schemas.AnomalyStatusRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    row = db.get(models.Anomaly, anomaly_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Anomaly not found.")
    rbac.assert_can_read_module(principal, row.module)
    try:
        updated = anomaly_engine.set_status(
            db, row, body.status,
            actor_email=principal.email, actor_role=principal.role, note=body.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return serializers.anomaly(updated)


@router.patch("/{anomaly_id}/assign")
def assign(
    anomaly_id: int,
    body: schemas.AnomalyAssignRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    row = db.get(models.Anomaly, anomaly_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Anomaly not found.")
    rbac.assert_can_read_module(principal, row.module)
    row.owner_email = body.owner_email
    db.commit()
    db.refresh(row)

    from services import audit

    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="anomaly.assigned",
        entity_type="anomaly",
        entity_id=row.reference,
        summary=f"{row.reference} assigned to {body.owner_email}",
    )
    return serializers.anomaly(row)


@router.post("/scan")
def scan(
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    return anomaly_engine.scan(db, actor_email=principal.email)


@router.get("/rules/list")
def list_rules(
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rows = db.query(models.AnomalyRule).order_by(models.AnomalyRule.domain, models.AnomalyRule.name).all()
    return [serializers.rule(row) for row in rows]


@router.patch("/rules/{code}")
def update_rule(
    code: str,
    body: schemas.RuleUpdateRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rbac.assert_can(principal, "tune_rules")
    rule = db.query(models.AnomalyRule).filter(models.AnomalyRule.code == code).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="Rule not found.")

    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is not None:
            setattr(rule, field, value)
    db.commit()
    db.refresh(rule)

    from services import audit

    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="anomaly.rule_updated",
        entity_type="anomaly_rule",
        entity_id=rule.code,
        summary=f"Tuned rule {rule.name}",
        details=changes,
    )
    return serializers.rule(rule)
