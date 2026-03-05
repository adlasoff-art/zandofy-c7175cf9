"""Authentification — spec Zandofy (profiles, JWT 15min + refresh 7j)."""
import secrets
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.profile import Profile, UserRole
from app.schemas.auth import (
    RegisterIn,
    LoginIn,
    TokenOut,
    RefreshIn,
    ForgotPasswordIn,
    ResetPasswordIn,
    UserOut,
)
from app.services.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    create_reset_password_token,
    decode_reset_password_token,
    create_verify_email_token,
    decode_verify_email_token,
)
from app.middleware.auth import get_current_user
from app.config import settings
from app.services.email_service import send_password_reset
from app.utils.date_utils import utc_now

router = APIRouter(prefix="/auth", tags=["auth"])


def _make_tokens(profile: Profile) -> TokenOut:
    sub = str(profile.id)
    return TokenOut(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
        token_type="bearer",
        expires_in=settings.jwt_access_expire_minutes * 60,
    )


@router.post("/register", response_model=TokenOut)
async def register(data: RegisterIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    profile = Profile(
        id=uuid4(),
        email=data.email,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        referral_code=secrets.token_urlsafe(8).upper()[:12],
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return _make_tokens(profile)


@router.post("/login", response_model=TokenOut)
async def login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    profile = result.scalar_one_or_none()
    if not profile or not verify_password(data.password, profile.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if profile.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is banned")
    return _make_tokens(profile)


@router.post("/refresh", response_model=TokenOut)
async def refresh(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    token = body.refresh_token
    payload = decode_refresh_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    result = await db.execute(select(Profile).where(Profile.id == UUID(payload["sub"])))
    profile = result.scalar_one_or_none()
    if not profile or profile.is_banned:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return _make_tokens(profile)


@router.post("/logout")
async def logout():
    # Stateless JWT: client removes tokens. Optionally use a blacklist (Redis) later.
    return {"message": "Logged out"}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.email == data.email))
    profile = result.scalar_one_or_none()
    if not profile:
        return {"message": "If this email exists, a reset link has been sent"}
    reset_token = create_reset_password_token(profile.id)
    base = (settings.site_base_url or "https://zandofy.com").rstrip("/")
    reset_link = f"{base}/reset-password?token={reset_token}"
    if profile.email and settings.smtp_host:
        await send_password_reset(profile.email, reset_link, expires_minutes=60)
    return {"message": "If this email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordIn, db: AsyncSession = Depends(get_db)):
    payload = decode_reset_password_token(data.token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    result = await db.execute(select(Profile).where(Profile.id == UUID(payload["sub"])))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
    profile.password_hash = get_password_hash(data.new_password)
    await db.flush()
    return {"message": "Password reset successful"}


@router.get("/verify-email/{token}")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    payload = decode_verify_email_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    result = await db.execute(select(Profile).where(Profile.id == UUID(payload["sub"])))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
    profile.email_verified = True
    profile.email_verified_at = utc_now()
    await db.flush()
    return {"message": "Email verified"}


@router.get("/me", response_model=UserOut)
async def me(
    profile: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserRole).where(UserRole.user_id == profile.id))
    roles = [r.role.value for r in result.scalars().all()]
    return UserOut(
        id=profile.id,
        email=profile.email,
        first_name=profile.first_name,
        last_name=profile.last_name,
        phone=profile.phone,
        avatar_url=profile.avatar_url,
        customer_tier=profile.customer_tier or "bronze",
        is_banned=profile.is_banned,
        email_verified=profile.email_verified,
        roles=roles,
    )
