"""Role and module permissions.

The BRD requires that users only see the data their role allows, "exactly as
they would in the source system". Until the deployment is wired to the ERP's
own identity provider, the mapping lives here and is enforced in one place:
every metric read goes through `assert_can_read_module`.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

import models

ALL_MODULES = ("finance", "crm", "projects", "hr", "procurement", "security")

ROLE_MODULES: dict[str, tuple[str, ...]] = {
    "admin": ALL_MODULES,
    "top_management": ALL_MODULES,
    "reviewer": (),          # falls back to the reviewer's team scope
    "analyst": (),           # falls back to team scope
    "viewer": (),
}

# Actions each role may perform, beyond reading.
ROLE_ACTIONS: dict[str, set[str]] = {
    "admin": {"approve", "publish", "generate", "tune_rules", "manage_users", "manage_sources"},
    "top_management": {"approve", "publish", "generate"},
    "reviewer": {"approve", "generate"},
    "analyst": {"generate"},
    "viewer": set(),
}

DEFAULT_USER_EMAIL = "admin@misagent.local"


@dataclass
class Principal:
    email: str
    full_name: str
    role: str
    team_id: int | None
    team_name: str | None
    modules: tuple[str, ...]

    def can(self, action: str) -> bool:
        return action in ROLE_ACTIONS.get(self.role, set())

    def can_read(self, module: str | None) -> bool:
        if not module or module == "all":
            return True
        return module in self.modules


def resolve_modules(user: models.User) -> tuple[str, ...]:
    role_scope = ROLE_MODULES.get(user.role, ())
    if role_scope:
        return role_scope
    team_scope = tuple((user.team.scope_modules or []) if user.team else ())
    return team_scope or ("finance",)


def current_user(
    db: Session,
    x_user_email: str | None = Header(default=None, alias="X-User-Email"),
) -> Principal:
    """Resolve the caller.

    Identity arrives as a header so the demo can switch personas. A production
    deployment replaces this with the ERP's SSO token — the rest of the code
    only depends on the `Principal` it returns.
    """
    email = x_user_email or DEFAULT_USER_EMAIL
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        user = db.query(models.User).filter(models.User.email == DEFAULT_USER_EMAIL).first()
    if user is None:
        return Principal(email, "Unknown", "viewer", None, None, ("finance",))
    return Principal(
        email=user.email,
        full_name=user.full_name or user.email,
        role=user.role,
        team_id=user.team_id,
        team_name=user.team.name if user.team else None,
        modules=resolve_modules(user),
    )


def assert_can_read_module(principal: Principal, module: str | None) -> None:
    if not principal.can_read(module):
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your role ({principal.role}) does not have access to {module} data. "
                "Ask an administrator to extend your team scope."
            ),
        )


def assert_can(principal: Principal, action: str) -> None:
    if not principal.can(action):
        raise HTTPException(
            status_code=403,
            detail=f"Your role ({principal.role}) is not permitted to {action.replace('_', ' ')}.",
        )
