"""Approval queue and decisions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import database
import models
import schemas
from deps import get_principal
from routers import serializers
from services import approvals as approval_service
from services import rbac

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


def _get_run(db: Session, run_id: int) -> models.ReportRun:
    run = db.get(models.ReportRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Report run not found.")
    return run


@router.get("")
def list_pending(
    status: str = Query(default="pending"),
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    query = db.query(models.Approval)
    if status != "all":
        query = query.filter(models.Approval.status == status)

    items = []
    for approval in query.order_by(models.Approval.requested_at.desc()).all():
        run = approval.run
        if run is None or run.template is None:
            continue
        if not principal.can_read(run.template.module):
            continue
        payload = serializers.approval(approval)
        payload["run"] = serializers.run(run, include_content=False)
        payload["is_mine"] = (
            principal.team_id is not None
            and approval.reviewer_team_id == principal.team_id
        ) or principal.role in ("admin", "top_management")
        items.append(payload)
    return items


@router.get("/summary")
def summary(
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    approvals = db.query(models.Approval).all()
    visible = [
        a for a in approvals
        if a.run and a.run.template and principal.can_read(a.run.template.module)
    ]
    pending = [a for a in visible if a.status == "pending"]
    return {
        "pending": len(pending),
        "awaiting_my_team": len([
            a for a in pending if a.reviewer_team_id == principal.team_id
        ]),
        "escalated": len([a for a in pending if a.escalated_at]),
        "unopened": len([a for a in pending if a.opened_at is None]),
        "approved_this_month": len([
            a for a in visible
            if a.status == "approved" and a.decided_at
            and a.decided_at.month == models.utcnow().month
        ]),
        "rejected_this_month": len([
            a for a in visible
            if a.status == "rejected" and a.decided_at
            and a.decided_at.month == models.utcnow().month
        ]),
    }


@router.post("/runs/{run_id}/approve")
def approve(
    run_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rbac.assert_can(principal, "approve")
    run = _get_run(db, run_id)
    rbac.assert_can_read_module(principal, run.template.module if run.template else None)
    return serializers.run(approval_service.approve(db, run, principal), include_content=False)


@router.post("/runs/{run_id}/reject")
def reject(
    run_id: int,
    body: schemas.RejectRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rbac.assert_can(principal, "approve")
    run = _get_run(db, run_id)
    rbac.assert_can_read_module(principal, run.template.module if run.template else None)
    return serializers.run(
        approval_service.reject(db, run, principal, body.reason), include_content=False
    )


@router.post("/runs/{run_id}/publish")
def publish(
    run_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rbac.assert_can(principal, "publish")
    run = _get_run(db, run_id)
    rbac.assert_can_read_module(principal, run.template.module if run.template else None)
    return serializers.run(approval_service.publish(db, run, principal), include_content=False)


@router.post("/runs/{run_id}/annotations")
def annotate(
    run_id: int,
    body: schemas.AnnotationRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    run = _get_run(db, run_id)
    rbac.assert_can_read_module(principal, run.template.module if run.template else None)
    annotation = approval_service.annotate(
        db,
        run,
        principal,
        section_key=body.section_key,
        metric_key=body.metric_key,
        body=body.body,
    )
    return serializers.annotation(annotation)
