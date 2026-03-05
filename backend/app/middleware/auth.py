"""Dépendances auth et RBAC — spec Zandofy (profiles + user_roles)."""
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.profile import Profile, UserRole, AppRole
from app.services.security import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Profile | None:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        return None
    result = await db.execute(select(Profile).where(Profile.id == UUID(payload["sub"])))
    profile = result.scalar_one_or_none()
    if profile and profile.is_banned:
        return None
    return profile


async def get_current_user(profile: Annotated[Profile | None, Depends(get_current_user_optional)]) -> Profile:
    if profile is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return profile


def require_roles(*allowed: AppRole):
    """L'utilisateur doit avoir au moins un des rôles (via user_roles)."""

    async def _check(
        current_user: Annotated[Profile, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> Profile:
        result = await db.execute(
            select(UserRole).where(
                UserRole.user_id == current_user.id,
                UserRole.role.in_(allowed),
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return _check


RequireAdmin = require_roles(AppRole.admin)
RequireManager = require_roles(AppRole.admin, AppRole.manager)
RequireVendor = require_roles(AppRole.admin, AppRole.manager, AppRole.vendor)
RequireShipper = require_roles(AppRole.admin, AppRole.manager, AppRole.shipper)
RequireRider = require_roles(AppRole.admin, AppRole.manager, AppRole.rider)


async def get_current_user_roles(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[str]:
    """Retourne la liste des rôles (strings) de l'utilisateur courant."""
    result = await db.execute(
        select(UserRole.role).where(UserRole.user_id == current_user.id)
    )
    return [r.value for r in result.scalars().all()]
