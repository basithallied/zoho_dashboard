"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Depends, Header
from sqlalchemy.orm import Session

import database
from services import rbac


def get_principal(
    db: Session = Depends(database.get_db),
    x_user_email: str | None = Header(default=None, alias="X-User-Email"),
) -> rbac.Principal:
    return rbac.current_user(db, x_user_email)
