"""Admin — dashboard, users (profiles), audit (admin_audit_logs), RGPD, set_password, impersonate (spec)."""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.database import get_db
from app.middleware.auth import get_current_user, RequireAdmin, RequireManager
from app.models.profile import Profile, UserRole, AppRole
from app.models.order import Order
from app.models.store import Store
from app.models.misc import AdminAuditLog, PlatformSetting
from app.services.security import get_password_hash, create_impersonation_access_token, create_impersonation_refresh_token

router = APIRouter(prefix="/admin", tags=["admin"])

MANAGER_IMPERSONATION_KEY = "manager_impersonation_roles"


# --- Schémas admin set_password / impersonate ---
class SetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=6)


class UserProfileOut(BaseModel):
    id: UUID
    email: str | None
    first_name: str | None
    last_name: str | None
    roles: list[str]


class ImpersonateResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserProfileOut
    impersonated_by: UUID


class ImpersonationSettingsRequest(BaseModel):
    allowed_roles: list[str]


async def _get_user_roles(db: AsyncSession, user_id: UUID) -> list[str]:
    result = await db.execute(select(UserRole).where(UserRole.user_id == user_id))
    return [r.role.value for r in result.scalars().all()]


async def _get_manager_impersonation_allowed_roles(db: AsyncSession) -> list[str]:
    result = await db.execute(select(PlatformSetting.value).where(PlatformSetting.key == MANAGER_IMPERSONATION_KEY))
    row = result.scalar_one_or_none()
    if not row:
        return []
    val = row[0] if isinstance(row, tuple) else row
    if isinstance(val, dict):
        return list(val.get("allowed_roles", val.get("roles", [])))
    if isinstance(val, list):
        return list(val)
    return []


class DashboardOut(BaseModel):
    revenue: str
    orders_count: int
    new_users: int
    stores_count: int
    period_days: int


class ProfileAdminOut(BaseModel):
    id: UUID
    email: str | None
    first_name: str | None
    last_name: str | None
    is_banned: bool
    created_at: datetime | None


class AuditEntryOut(BaseModel):
    id: UUID
    admin_id: UUID
    target_user_id: UUID
    action: str
    details: dict | None
    created_at: datetime | None


@router.get("/dashboard", response_model=DashboardOut)
async def admin_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
    period_days: int = Query(30, ge=1, le=365),
):
    """Métriques globales (CA, commandes, utilisateurs, boutiques)."""
    since = datetime.now(timezone.utc) - timedelta(days=period_days)
    ca_result = await db.execute(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.created_at >= since,
            Order.status.in_(["confirmed", "processing", "shipped", "delivered"]),
        )
    )
    revenue = ca_result.scalar() or Decimal("0")
    orders_result = await db.execute(select(func.count(Order.id)).where(Order.created_at >= since))
    orders_count = orders_result.scalar() or 0
    users_result = await db.execute(select(func.count(Profile.id)).where(Profile.created_at >= since))
    new_users = users_result.scalar() or 0
    stores_result = await db.execute(select(func.count(Store.id)))
    stores_count = stores_result.scalar() or 0
    return DashboardOut(
        revenue=str(revenue),
        orders_count=orders_count,
        new_users=new_users,
        stores_count=stores_count,
        period_days=period_days,
    )


@router.get("/users", response_model=list[ProfileAdminOut])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    banned: bool | None = Query(None),
):
    """Liste des profils (utilisateurs)."""
    q = select(Profile).order_by(Profile.created_at.desc()).offset(offset).limit(limit)
    if banned is not None:
        q = q.where(Profile.is_banned == banned)
    result = await db.execute(q)
    profiles = result.scalars().all()
    return [
        ProfileAdminOut(
            id=p.id,
            email=p.email,
            first_name=p.first_name,
            last_name=p.last_name,
            is_banned=p.is_banned,
            created_at=p.created_at,
        )
        for p in profiles
    ]


@router.get("/users/{profile_id}", response_model=ProfileAdminOut)
async def get_user(
    profile_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return ProfileAdminOut(
        id=profile.id,
        email=profile.email,
        first_name=profile.first_name,
        last_name=profile.last_name,
        is_banned=profile.is_banned,
        created_at=profile.created_at,
    )


@router.put("/users/{user_id}/password")
async def set_user_password(
    user_id: UUID,
    body: SetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
):
    """Modification du mot de passe par l'admin (admin uniquement)."""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    profile.password_hash = get_password_hash(body.new_password)
    db.add(
        AdminAuditLog(
            admin_id=current_user.id,
            target_user_id=user_id,
            action="set_password",
            details={},
        )
    )
    await db.flush()
    return {"success": True}


@router.post("/users/{user_id}/impersonate", response_model=ImpersonateResponse)
async def impersonate_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireManager)],
):
    """Se connecter en tant qu'utilisateur. Admin : tout le monde ; Manager : rôles autorisés (jamais admin)."""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target_roles = await _get_user_roles(db, user_id)
    caller_roles = await _get_user_roles(db, current_user.id)
    is_admin = AppRole.admin.value in caller_roles
    if not is_admin:
        if AppRole.admin.value in target_roles:
            raise HTTPException(status_code=403, detail="Managers cannot impersonate admins")
        allowed = await _get_manager_impersonation_allowed_roles(db)
        allowed_set = set(allowed)
        effective_target_roles = target_roles if target_roles else ["customer"]
        for r in effective_target_roles:
            if r not in allowed_set:
                raise HTTPException(status_code=403, detail=f"Role {r} is not allowed for manager impersonation")
    target_roles_for_jwt = target_roles if target_roles else ["customer"]
    access_token = create_impersonation_access_token(
        subject=target.id,
        email=target.email,
        roles=target_roles_for_jwt,
        impersonated_by=current_user.id,
    )
    refresh_token = create_impersonation_refresh_token(subject=target.id, impersonated_by=current_user.id)
    db.add(
        AdminAuditLog(
            admin_id=current_user.id,
            target_user_id=user_id,
            action="impersonate",
            details={"target_email": target.email},
        )
    )
    await db.flush()
    return ImpersonateResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserProfileOut(
            id=target.id,
            email=target.email,
            first_name=target.first_name,
            last_name=target.last_name,
            roles=target_roles_for_jwt,
        ),
        impersonated_by=current_user.id,
    )


@router.put("/settings/impersonation")
async def update_impersonation_settings(
    body: ImpersonationSettingsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
):
    """Configurer les rôles que les managers peuvent impersonner (admin uniquement)."""
    result = await db.execute(select(PlatformSetting).where(PlatformSetting.key == MANAGER_IMPERSONATION_KEY))
    row = result.scalar_one_or_none()
    value = {"allowed_roles": body.allowed_roles}
    if row:
        row.value = value
    else:
        db.add(PlatformSetting(key=MANAGER_IMPERSONATION_KEY, value=value))
    await db.flush()
    return {"allowed_roles": body.allowed_roles}


class BanUpdateIn(BaseModel):
    is_banned: bool
    ban_reason: str | None = None


@router.patch("/users/{profile_id}/ban")
async def update_ban(
    profile_id: UUID,
    data: BanUpdateIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
    request: Request,
):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    profile.is_banned = data.is_banned
    profile.ban_reason = data.ban_reason if data.is_banned else None
    profile.banned_at = datetime.now(timezone.utc) if data.is_banned else None
    profile.banned_by = current_user.id if data.is_banned else None
    db.add(AdminAuditLog(admin_id=current_user.id, target_user_id=profile_id, action="ban_update", details={"is_banned": data.is_banned, "reason": data.ban_reason}))
    await db.flush()
    return {"is_banned": profile.is_banned}


@router.get("/audit-logs", response_model=list[AuditEntryOut])
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Logs d'audit admin (admin_audit_logs)."""
    result = await db.execute(
        select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).offset(offset).limit(limit)
    )
    logs = result.scalars().all()
    return [
        AuditEntryOut(
            id=l.id,
            admin_id=l.admin_id,
            target_user_id=l.target_user_id,
            action=l.action,
            details=l.details,
            created_at=l.created_at,
        )
        for l in logs
    ]


@router.post("/audit-logs")
async def create_audit_log(
    action: str,
    target_user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
    request: Request,
    details: dict | None = None,
):
    log = AdminAuditLog(
        admin_id=current_user.id,
        target_user_id=target_user_id,
        action=action,
        details=details,
    )
    db.add(log)
    await db.flush()
    return {"id": str(log.id)}


@router.get("/gdpr/export/{profile_id}")
async def gdpr_export_user(
    profile_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
):
    """Export des données utilisateur (RGPD)."""
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    roles_result = await db.execute(select(UserRole).where(UserRole.user_id == profile_id))
    roles = [r.role.value for r in roles_result.scalars().all()]
    return {
        "id": str(profile.id),
        "email": profile.email,
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "phone": profile.phone,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "roles": roles,
    }


@router.delete("/gdpr/delete/{profile_id}")
async def gdpr_delete_user(
    profile_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
):
    """Suppression des données utilisateur (RGPD)."""
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(profile)
    await db.flush()
    db.add(AdminAuditLog(admin_id=current_user.id, target_user_id=profile_id, action="gdpr_delete", details={}))
    await db.flush()
    return {"deleted": str(profile_id)}
