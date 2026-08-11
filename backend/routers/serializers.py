"""Dictionary shapes returned to the client."""

from __future__ import annotations

import models


def team(row: models.Team | None) -> dict | None:
    if row is None:
        return None
    return {"id": row.id, "name": row.name, "scope_modules": row.scope_modules or []}


def template(row: models.ReportTemplate, *, last_run: models.ReportRun | None = None) -> dict:
    return {
        "id": row.id,
        "code": row.code,
        "name": row.name,
        "description": row.description,
        "module": row.module,
        "cadence": row.cadence,
        "delivery_hour": row.delivery_hour,
        "is_active": row.is_active,
        "sections": row.sections or [],
        "thresholds": row.thresholds or {},
        "default_comparison": row.default_comparison,
        "owner_team": team(row.owner_team),
        "reviewer_team": team(row.reviewer_team),
        "escalation_team": team(row.escalation_team),
        "escalation_after_hours": row.escalation_after_hours,
        "recipients": row.recipients or [],
        "next_run_at": row.next_run_at.isoformat() if row.next_run_at else None,
        "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
        "last_run": run(last_run, include_content=False) if last_run else None,
    }


def approval(row: models.Approval) -> dict:
    return {
        "id": row.id,
        "run_id": row.run_id,
        "status": row.status,
        "reviewer_team": team(row.run.template.reviewer_team) if row.run else None,
        "reviewer_email": row.reviewer_email,
        "requested_at": row.requested_at.isoformat() if row.requested_at else None,
        "opened_at": row.opened_at.isoformat() if row.opened_at else None,
        "decided_at": row.decided_at.isoformat() if row.decided_at else None,
        "escalated_at": row.escalated_at.isoformat() if row.escalated_at else None,
        "reason": row.reason,
        # The UI disables Approve until this is true; the API enforces it too.
        "can_approve": row.opened_at is not None,
    }


def annotation(row: models.ReportAnnotation) -> dict:
    return {
        "id": row.id,
        "section_key": row.section_key,
        "metric_key": row.metric_key,
        "author_email": row.author_email,
        "body": row.body,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def run(row: models.ReportRun, *, include_content: bool = True) -> dict:
    payload = {
        "id": row.id,
        "template_id": row.template_id,
        "template_name": row.template.name if row.template else None,
        "template_code": row.template.code if row.template else None,
        "cadence": row.template.cadence if row.template else None,
        "module": row.template.module if row.template else None,
        "owner_team": team(row.template.owner_team) if row.template else None,
        "reviewer_team": team(row.template.reviewer_team) if row.template else None,
        "recipients": (row.template.recipients or []) if row.template else [],
        "period_label": row.period_label,
        "period_start": row.period_start.isoformat() if row.period_start else None,
        "period_end": row.period_end.isoformat() if row.period_end else None,
        "status": row.status,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
        "generation_ms": row.generation_ms,
        "published_at": row.published_at.isoformat() if row.published_at else None,
        "delivery_status": row.delivery_status,
        "delivery_error": row.delivery_error,
        "source_record_count": len(row.source_refs or []),
        "approvals": [approval(a) for a in row.approvals],
    }
    if include_content:
        payload["figures"] = row.figures or {}
        payload["commentary"] = row.commentary or {}
        payload["source_refs"] = row.source_refs or []
        payload["annotations"] = [annotation(a) for a in row.annotations]
    return payload


def anomaly(row: models.Anomaly, *, include_detail: bool = True) -> dict:
    payload = {
        "id": row.id,
        "reference": row.reference,
        "rule_code": row.rule_code,
        "domain": row.domain,
        "module": row.module,
        "severity": row.severity,
        "title": row.title,
        "status": row.status,
        "detected_at": row.detected_at.isoformat() if row.detected_at else None,
        "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
        "financial_impact": row.financial_impact,
        "impact_label": row.impact_label,
        "entity_label": row.entity_label,
        "owner_email": row.owner_email,
        "alerted": row.alert_sent_at is not None,
        "what_happened": row.what_happened,
    }
    if include_detail:
        payload.update({
            "why_it_matters": row.why_it_matters,
            "recommended_actions": row.recommended_actions or [],
            "facts": row.facts or {},
            "source_refs": row.source_refs or [],
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "resolution_note": row.resolution_note,
        })
    return payload


def rule(row: models.AnomalyRule) -> dict:
    detections = row.detections or 0
    return {
        "code": row.code,
        "name": row.name,
        "domain": row.domain,
        "module": row.module,
        "description": row.description,
        "enabled": row.enabled,
        "base_severity": row.base_severity,
        "params": row.params or {},
        "alert_immediately": row.alert_immediately,
        "detections": detections,
        "false_positives": row.false_positives or 0,
        "false_positive_rate": round((row.false_positives or 0) / detections * 100, 1) if detections else 0.0,
        "sensitivity": row.sensitivity,
    }


def data_source(row: models.DataSource) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "kind": row.kind,
        "vendor": row.vendor,
        "status": row.status,
        "access_mode": row.access_mode,
        "last_sync_at": row.last_sync_at.isoformat() if row.last_sync_at else None,
        "sync_interval_minutes": row.sync_interval_minutes,
        "record_count": row.record_count,
        "last_error": row.last_error,
    }


def audit_entry(row: models.AuditLog) -> dict:
    return {
        "id": row.id,
        "at": row.at.isoformat() if row.at else None,
        "actor_email": row.actor_email,
        "actor_role": row.actor_role,
        "action": row.action,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "summary": row.summary,
        "details": row.details or {},
    }


def user(row: models.User) -> dict:
    return {
        "id": row.id,
        "email": row.email,
        "full_name": row.full_name,
        "role": row.role,
        "is_active": row.is_active,
        "team": team(row.team),
        "last_login_at": row.last_login_at.isoformat() if row.last_login_at else None,
    }


def conversation(row: models.Conversation, *, include_messages: bool = False) -> dict:
    payload = {
        "id": row.id,
        "title": row.title,
        "user_email": row.user_email,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "is_saved": row.is_saved,
        "context": row.context or {},
        "message_count": len(row.messages),
    }
    if include_messages:
        payload["messages"] = [
            {
                "id": m.id,
                "role": m.role,
                "text": m.text,
                "payload": m.payload or {},
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in row.messages
        ]
    return payload
