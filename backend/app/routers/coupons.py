"""Coupons — validation, liste (spec); CRUD admin (création)."""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user, RequireAdmin
from app.models.profile import Profile
from app.models.misc import Coupon

router = APIRouter(prefix="/coupons", tags=["coupons"])


class CouponValidateOut(BaseModel):
    code: str
    discount_type: str
    discount_value: str
    min_order_amount: str | None
    valid: bool


class CouponOut(BaseModel):
    id: UUID
    code: str
    discount_type: str
    discount_value: str
    min_order_amount: str | None
    max_uses: int | None
    current_uses: int
    expires_at: datetime | None
    is_active: bool


class CouponCreateIn(BaseModel):
    code: str
    discount_type: str = "percentage"
    discount_value: str = "0"
    min_order_amount: str | None = None
    max_uses: int | None = None
    expires_at: datetime | None = None


@router.get("/validate", response_model=CouponValidateOut)
async def validate_coupon(
    code: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """Vérifie un code promo et retourne la réduction (public)."""
    result = await db.execute(select(Coupon).where(Coupon.code == code.strip().upper()))
    coupon = result.scalar_one_or_none()
    if not coupon:
        return CouponValidateOut(
            code=code,
            discount_type="percentage",
            discount_value="0",
            min_order_amount=None,
            valid=False,
        )
    now = datetime.now(timezone.utc)
    if not coupon.is_active:
        return CouponValidateOut(code=coupon.code, discount_type=coupon.discount_type, discount_value=str(coupon.discount_value), min_order_amount=str(coupon.min_order_amount) if coupon.min_order_amount else None, valid=False)
    if coupon.expires_at and coupon.expires_at < now:
        return CouponValidateOut(code=coupon.code, discount_type=coupon.discount_type, discount_value=str(coupon.discount_value), min_order_amount=str(coupon.min_order_amount) if coupon.min_order_amount else None, valid=False)
    if coupon.max_uses is not None and coupon.current_uses >= coupon.max_uses:
        return CouponValidateOut(code=coupon.code, discount_type=coupon.discount_type, discount_value=str(coupon.discount_value), min_order_amount=str(coupon.min_order_amount) if coupon.min_order_amount else None, valid=False)
    return CouponValidateOut(
        code=coupon.code,
        discount_type=coupon.discount_type,
        discount_value=str(coupon.discount_value),
        min_order_amount=str(coupon.min_order_amount) if coupon.min_order_amount else None,
        valid=True,
    )


@router.get("", response_model=list[CouponOut])
async def list_coupons(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
    active_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Liste des coupons (vendeur: lecture; admin: tous)."""
    q = select(Coupon).order_by(Coupon.created_at.desc())
    if active_only:
        q = q.where(Coupon.is_active == True)
        now = datetime.now(timezone.utc)
        q = q.where((Coupon.expires_at.is_(None)) | (Coupon.expires_at > now))
    result = await db.execute(q.offset(offset).limit(limit))
    coupons = result.scalars().all()
    return [
        CouponOut(
            id=c.id,
            code=c.code,
            discount_type=c.discount_type,
            discount_value=str(c.discount_value),
            min_order_amount=str(c.min_order_amount) if c.min_order_amount else None,
            max_uses=c.max_uses,
            current_uses=c.current_uses,
            expires_at=c.expires_at,
            is_active=c.is_active,
        )
        for c in coupons
    ]


@router.post("", response_model=CouponOut, status_code=201)
async def create_coupon(
    data: CouponCreateIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
):
    """Création d'un coupon (admin)."""
    code_upper = data.code.strip().upper()
    if not code_upper:
        raise HTTPException(status_code=400, detail="Code required")
    existing = await db.execute(select(Coupon).where(Coupon.code == code_upper))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Code already exists")
    try:
        discount_value = Decimal(data.discount_value)
        min_order_amount = Decimal(data.min_order_amount) if data.min_order_amount else None
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid numeric value")
    coupon = Coupon(
        code=code_upper,
        discount_type=data.discount_type,
        discount_value=discount_value,
        min_order_amount=min_order_amount,
        max_uses=data.max_uses,
        expires_at=data.expires_at,
        is_active=True,
    )
    db.add(coupon)
    await db.flush()
    await db.refresh(coupon)
    return CouponOut(
        id=coupon.id,
        code=coupon.code,
        discount_type=coupon.discount_type,
        discount_value=str(coupon.discount_value),
        min_order_amount=str(coupon.min_order_amount) if coupon.min_order_amount else None,
        max_uses=coupon.max_uses,
        current_uses=coupon.current_uses,
        expires_at=coupon.expires_at,
        is_active=coupon.is_active,
    )


@router.patch("/{coupon_id}/toggle")
async def toggle_coupon(
    coupon_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
):
    """Active/désactive un coupon (admin)."""
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    coupon.is_active = not coupon.is_active
    await db.flush()
    return {"id": str(coupon.id), "is_active": coupon.is_active}
