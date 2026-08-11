"""Request bodies.

Responses are assembled as plain dictionaries by the serialisers in
`routers/serializers.py`, because most of them are nested report payloads that
gain nothing from a second model definition.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class RejectRequest(BaseModel):
    reason: str = Field(min_length=10, description="Required — recorded against the approval.")


class AnnotationRequest(BaseModel):
    section_key: str
    metric_key: Optional[str] = None
    body: str = Field(min_length=1)


class AnomalyStatusRequest(BaseModel):
    status: str = Field(description="active | investigating | resolved | ignored | false_positive")
    note: Optional[str] = None


class AnomalyAssignRequest(BaseModel):
    owner_email: str


class RuleUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    params: Optional[dict[str, Any]] = None
    base_severity: Optional[str] = None
    alert_immediately: Optional[bool] = None


class TemplateRequest(BaseModel):
    """Report templates are configuration — sections and thresholds are editable."""

    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None
    cadence: Optional[str] = None
    delivery_hour: Optional[int] = None
    is_active: Optional[bool] = None
    sections: Optional[list[dict[str, Any]]] = None
    thresholds: Optional[dict[str, float]] = None
    default_comparison: Optional[str] = None
    owner_team_id: Optional[int] = None
    reviewer_team_id: Optional[int] = None
    escalation_team_id: Optional[int] = None
    escalation_after_hours: Optional[int] = None
    recipients: Optional[list[str]] = None


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None


class ConversationRequest(BaseModel):
    title: Optional[str] = None
    is_saved: Optional[bool] = None
