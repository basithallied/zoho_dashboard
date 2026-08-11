"""Audit trail helper.

Every action that changes state, and every read of report content or data
through chat, is written here. Nothing else writes to `audit_logs`.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

import models


def record(
    db: Session,
    *,
    actor_email: str,
    actor_role: str = "",
    action: str,
    entity_type: str,
    entity_id: str | int,
    summary: str,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
    commit: bool = True,
) -> models.AuditLog:
    entry = models.AuditLog(
        actor_email=actor_email,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        summary=summary,
        details=details or {},
        ip_address=ip_address,
    )
    db.add(entry)
    if commit:
        db.commit()
        db.refresh(entry)
    return entry
