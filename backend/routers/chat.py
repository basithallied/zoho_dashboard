"""Chat with data: conversations, questions and structured answers."""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import database
import models
import schemas
from deps import get_principal
from routers import serializers
from services import chat_agent, metrics, rbac

router = APIRouter(prefix="/api/chat", tags=["chat"])

SUGGESTED_PROMPTS = [
    "Show total sales for this month vs last month",
    "Which business unit had the highest revenue this quarter?",
    "Show me top 10 customers by revenue",
    "What are the overdue receivables?",
    "Monthly expense trend for this year",
    "Open pipeline by owner",
]


@router.get("/conversations")
def list_conversations(
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    rows = (
        db.query(models.Conversation)
        .filter(models.Conversation.user_email == principal.email)
        .order_by(models.Conversation.updated_at.desc())
        .all()
    )
    return [serializers.conversation(row) for row in rows]


@router.post("/conversations")
def create_conversation(
    body: schemas.ConversationRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    conversation = models.Conversation(
        title=body.title or "New conversation",
        user_email=principal.email,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return serializers.conversation(conversation, include_messages=True)


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    conversation = _owned(db, conversation_id, principal)
    return serializers.conversation(conversation, include_messages=True)


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    conversation_id: int,
    body: schemas.ConversationRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    conversation = _owned(db, conversation_id, principal)
    if body.title is not None:
        conversation.title = body.title
    if body.is_saved is not None:
        conversation.is_saved = body.is_saved
    db.commit()
    db.refresh(conversation)
    return serializers.conversation(conversation)


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    conversation = _owned(db, conversation_id, principal)
    db.delete(conversation)
    db.commit()
    return {"status": "deleted"}


def _owned(db: Session, conversation_id: int, principal: rbac.Principal) -> models.Conversation:
    conversation = db.get(models.Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if conversation.user_email != principal.email:
        raise HTTPException(status_code=403, detail="That conversation belongs to another user.")
    return conversation


@router.post("/ask")
def ask(
    body: schemas.ChatRequest,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    conversation = None
    if body.conversation_id:
        conversation = _owned(db, body.conversation_id, principal)
    else:
        conversation = models.Conversation(
            title=body.message[:60] or "New conversation",
            user_email=principal.email,
        )
        db.add(conversation)
        db.flush()

    db.add(models.ChatMessage(conversation_id=conversation.id, role="user", text=body.message))
    payload = chat_agent.answer(db, principal, body.message, conversation)
    db.add(
        models.ChatMessage(
            conversation_id=conversation.id,
            role="agent",
            text=payload["answer"],
            payload=payload,
        )
    )
    if conversation.title == "New conversation":
        conversation.title = body.message[:60]
    db.commit()
    db.refresh(conversation)

    return {"conversation_id": conversation.id, "answer": payload}


@router.get("/suggestions")
def suggestions(principal: rbac.Principal = Depends(get_principal)):
    available = metrics.for_modules(principal.modules)
    return {
        "prompts": SUGGESTED_PROMPTS,
        "metrics": [
            {"key": m.key, "label": m.label, "module": m.module, "description": m.description}
            for m in available
        ],
    }


@router.get("/messages/{message_id}/export.csv")
def export_answer(
    message_id: int,
    db: Session = Depends(database.get_db),
    principal: rbac.Principal = Depends(get_principal),
):
    """One-click export of the table behind an answer."""
    message = db.get(models.ChatMessage, message_id)
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found.")
    _owned(db, message.conversation_id, principal)

    table = (message.payload or {}).get("table") or {"columns": [], "rows": []}
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(table.get("columns", []))
    writer.writerows(table.get("rows", []))
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="answer-{message_id}.csv"'},
    )
