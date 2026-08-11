"""Approval routing.

    draft -> in_review -> approved -> published
                  |
                  +-> rejected -> (regenerated as a new run)

Two rules from the BRD are enforced here rather than in the UI, because the UI
is not the only client:

* a reviewer cannot approve a run they have not opened;
* a rejection without a reason is not a rejection.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

import models
from services import audit
from services.rbac import Principal

MIN_REASON_LENGTH = 10


def _approval_for(db: Session, run: models.ReportRun) -> models.Approval:
    approval = (
        db.query(models.Approval)
        .filter(models.Approval.run_id == run.id, models.Approval.status == "pending")
        .first()
    )
    if approval is None:
        raise HTTPException(status_code=409, detail="This report has no pending review.")
    return approval


def mark_opened(db: Session, run: models.ReportRun, principal: Principal) -> None:
    """Stamp that the reviewer actually looked at the content.

    Called from the endpoint that serves report content, so opening the report
    is the only way to satisfy the approval guard.
    """
    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="report.viewed",
        entity_type="report_run",
        entity_id=run.id,
        summary=f"Opened {run.template.name} for {run.period_label}",
        commit=False,
    )
    approval = (
        db.query(models.Approval)
        .filter(models.Approval.run_id == run.id, models.Approval.status == "pending")
        .first()
    )
    if approval is not None and approval.opened_at is None:
        approval.opened_at = models.utcnow()
        approval.reviewer_email = principal.email
    db.commit()


def approve(db: Session, run: models.ReportRun, principal: Principal) -> models.ReportRun:
    if run.status != "in_review":
        raise HTTPException(
            status_code=409,
            detail=f"Only a report in review can be approved (this one is {run.status}).",
        )
    approval = _approval_for(db, run)

    if approval.opened_at is None:
        raise HTTPException(
            status_code=409,
            detail="Open the report before approving it — approvals are recorded against a review.",
        )

    approval.status = "approved"
    approval.reviewer_email = principal.email
    approval.decided_at = models.utcnow()
    run.status = "approved"
    db.commit()
    db.refresh(run)

    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="report.approved",
        entity_type="report_run",
        entity_id=run.id,
        summary=f"Approved {run.template.name} for {run.period_label}",
        details={"opened_at": approval.opened_at.isoformat()},
    )
    return run


def reject(db: Session, run: models.ReportRun, principal: Principal, reason: str) -> models.ReportRun:
    if run.status != "in_review":
        raise HTTPException(
            status_code=409,
            detail=f"Only a report in review can be rejected (this one is {run.status}).",
        )
    if not reason or len(reason.strip()) < MIN_REASON_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"A rejection needs a reason of at least {MIN_REASON_LENGTH} characters.",
        )

    approval = _approval_for(db, run)
    approval.status = "rejected"
    approval.reviewer_email = principal.email
    approval.decided_at = models.utcnow()
    approval.reason = reason.strip()
    run.status = "rejected"
    db.commit()
    db.refresh(run)

    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="report.rejected",
        entity_type="report_run",
        entity_id=run.id,
        summary=f"Rejected {run.template.name} for {run.period_label}",
        details={"reason": reason.strip()},
    )
    return run


def publish(db: Session, run: models.ReportRun, principal: Principal) -> models.ReportRun:
    """Release an approved run to its recipients.

    Nothing reaches management without a logged approval — that check is this
    status guard, and it is the only path that sets `published_at`.
    """
    if run.status != "approved":
        raise HTTPException(
            status_code=409,
            detail="Only an approved report can be published to recipients.",
        )

    run.status = "published"
    run.published_at = models.utcnow()
    run.delivery_status = "delivered"
    db.commit()
    db.refresh(run)

    recipients = run.template.recipients or []
    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="report.published",
        entity_type="report_run",
        entity_id=run.id,
        summary=(
            f"Published {run.template.name} for {run.period_label} to "
            f"{len(recipients)} recipient(s)"
        ),
        details={"recipients": recipients},
    )
    return run


def annotate(
    db: Session,
    run: models.ReportRun,
    principal: Principal,
    *,
    section_key: str,
    metric_key: str | None,
    body: str,
) -> models.ReportAnnotation:
    annotation = models.ReportAnnotation(
        run_id=run.id,
        section_key=section_key,
        metric_key=metric_key,
        author_email=principal.email,
        body=body.strip(),
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)

    audit.record(
        db,
        actor_email=principal.email,
        actor_role=principal.role,
        action="report.annotated",
        entity_type="report_run",
        entity_id=run.id,
        summary=f"Annotated {section_key}/{metric_key or 'section'}",
        details={"body": annotation.body},
    )
    return annotation
