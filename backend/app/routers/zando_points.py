"""ZandoPoints — solde, historique, parrainage (spec: Profile)."""
from decimal import Decimal
from uuid import uuid4
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.profile import Profile
from app.models.loyalty import ZandoPoints, PointTransaction, Referral

router = APIRouter(prefix="/zando-points", tags=["zando-points"])


class PointsBalanceOut(BaseModel):
    balance: str
    pending_balance: str
    total_earned: str


class PointTransactionOut(BaseModel):
    id: str
    type: str
    amount: str
    description: str | None
    order_id: str | None
    created_at: str


async def _get_or_create_points(db: AsyncSession, user_id) -> ZandoPoints:
    result = await db.execute(select(ZandoPoints).where(ZandoPoints.user_id == user_id))
    row = result.scalar_one_or_none()
    if not row:
        row = ZandoPoints(id=uuid4(), user_id=user_id)
        db.add(row)
        await db.flush()
        await db.refresh(row)
    return row


@router.get("/balance", response_model=PointsBalanceOut)
async def get_balance(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    points = await _get_or_create_points(db, current_user.id)
    return PointsBalanceOut(
        balance=str(points.balance),
        pending_balance=str(points.pending_balance),
        total_earned=str(points.total_earned),
    )


@router.get("/history", response_model=list[PointTransactionOut])
async def get_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    result = await db.execute(
        select(PointTransaction)
        .where(PointTransaction.user_id == current_user.id)
        .order_by(PointTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    tx_list = result.scalars().all()
    return [
        PointTransactionOut(
            id=str(t.id),
            type=t.type,
            amount=str(t.amount),
            description=t.description,
            order_id=str(t.order_id) if t.order_id else None,
            created_at=t.created_at.isoformat() if t.created_at else None,
        )
        for t in tx_list
    ]


@router.get("/referral-code")
async def get_my_referral_code(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    """Retourne le code parrain du profil (referral_code sur profiles)."""
    return {"referral_code": current_user.referral_code or ""}


@router.get("/referrals")
async def list_my_referrals(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    result = await db.execute(
        select(Referral).where(Referral.referrer_id == current_user.id).order_by(Referral.created_at.desc())
    )
    refs = result.scalars().all()
    return [
        {"id": str(r.id), "referee_id": str(r.referee_id) if r.referee_id else None, "status": r.status, "rewarded_orders_count": r.rewarded_orders_count}
        for r in refs
    ]
