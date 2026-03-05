"""Wallet vendeur — solde, transactions, demandes de retrait (spec: Store, VendorWallet)."""
from decimal import Decimal
from uuid import uuid4
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.config import settings
from app.middleware.auth import get_current_user, RequireVendor
from app.models.profile import Profile
from app.models.store import Store
from app.models.vendor import VendorWallet, VendorTransaction, WithdrawalRequest

router = APIRouter(prefix="/vendor/wallet", tags=["vendor-wallet"])


class WalletOut(BaseModel):
    available_balance: str
    pending_balance: str
    total_earned: str
    total_withdrawn: str
    retention_days: int


class WithdrawRequestIn(BaseModel):
    amount: str
    method: str = "mobile_money"
    phone_number: str | None = None


class WithdrawalRequestOut(BaseModel):
    id: str
    amount: str
    method: str
    status: str
    created_at: str


class TransactionOut(BaseModel):
    id: str
    type: str
    amount: str
    description: str | None
    order_id: str | None
    created_at: str


async def _get_or_create_wallet(db: AsyncSession, store_id) -> VendorWallet:
    result = await db.execute(select(VendorWallet).where(VendorWallet.store_id == store_id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        wallet = VendorWallet(
            id=uuid4(),
            store_id=store_id,
            retention_days=settings.vendor_retention_days,
        )
        db.add(wallet)
        await db.flush()
        await db.refresh(wallet)
    return wallet


@router.get("", response_model=WalletOut)
async def get_wallet(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
):
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    wallet = await _get_or_create_wallet(db, store.id)
    return WalletOut(
        available_balance=str(wallet.available_balance),
        pending_balance=str(wallet.pending_balance),
        total_earned=str(wallet.total_earned),
        total_withdrawn=str(wallet.total_withdrawn),
        retention_days=wallet.retention_days,
    )


@router.get("/transactions", response_model=list[TransactionOut])
async def list_transactions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        return []
    result = await db.execute(
        select(VendorTransaction)
        .where(VendorTransaction.store_id == store.id)
        .order_by(VendorTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    tx_list = result.scalars().all()
    return [
        TransactionOut(
            id=str(t.id),
            type=t.type,
            amount=str(t.amount),
            description=t.description,
            order_id=str(t.order_id) if t.order_id else None,
            created_at=t.created_at.isoformat() if t.created_at else None,
        )
        for t in tx_list
    ]


@router.post("/withdraw", response_model=WithdrawalRequestOut, status_code=201)
async def request_withdrawal(
    data: WithdrawRequestIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
):
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    wallet = await _get_or_create_wallet(db, store.id)
    amount = Decimal(data.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if amount > wallet.available_balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    req = WithdrawalRequest(
        store_id=store.id,
        amount=amount,
        method=data.method,
        phone_number=data.phone_number,
        status="pending",
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)
    return WithdrawalRequestOut(
        id=str(req.id),
        amount=str(req.amount),
        method=req.method,
        status=req.status,
        created_at=req.created_at.isoformat() if req.created_at else None,
    )


@router.get("/withdrawals", response_model=list[WithdrawalRequestOut])
async def list_withdrawals(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        return []
    result = await db.execute(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.store_id == store.id)
        .order_by(WithdrawalRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    reqs = result.scalars().all()
    return [
        WithdrawalRequestOut(
            id=str(r.id),
            amount=str(r.amount),
            method=r.method,
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in reqs
    ]
