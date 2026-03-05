"""Initiation paiement KelPay (Mobile Money + carte) — spec: profiles, orders (total, shipping_cost)."""
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.profile import Profile
from app.models.order import Order
from app.models.payment import PaymentTransaction
from app.services.kelpay import initiate_payment as kelpay_initiate

router = APIRouter(prefix="/payments", tags=["payments"])

DEFAULT_CURRENCY = "USD"


class InitPaymentRequest(BaseModel):
    order_id: UUID
    payment_method: str = "mobile_money"  # mobile_money, card, orange, airtel, mpesa
    callback_url: str | None = None


@router.post("/init")
async def init_payment(
    data: InitPaymentRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    result = await db.execute(select(Order).where(Order.id == data.order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.status != "pending":
        raise HTTPException(status_code=400, detail="Order already paid or cancelled")

    amount = float(order.total + (order.shipping_cost or 0))
    try:
        kelpay_response = await kelpay_initiate(
            order_id=str(order.id),
            amount=amount,
            currency=DEFAULT_CURRENCY,
            customer_email=current_user.email,
            payment_method=data.payment_method,
            callback_url=data.callback_url,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Payment gateway error: {e}")

    provider_ref = kelpay_response.get("payment_id") or kelpay_response.get("reference") or kelpay_response.get("id")
    unique_ref = f"kelpay_{order.id}_{provider_ref}" if provider_ref else f"kelpay_{order.id}_{order.order_ref}"
    tx = PaymentTransaction(
        order_id=order.id,
        user_id=current_user.id,
        amount=order.total,
        currency=DEFAULT_CURRENCY,
        status="pending",
        provider="kelpay",
        reference=unique_ref[:255],
        transaction_id=str(provider_ref) if provider_ref else None,
        callback_payload=kelpay_response,
    )
    db.add(tx)
    await db.flush()
    await db.refresh(tx)

    return {
        "transaction_id": str(tx.id),
        "payment_url": kelpay_response.get("payment_url") or kelpay_response.get("redirect_url"),
        "provider_reference": provider_ref,
        "status": "pending",
    }


@router.get("/status")
async def payment_status(
    order_id: UUID | None = None,
    transaction_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Polling: statut du paiement par order_id ou transaction_id."""
    if not order_id and not transaction_id:
        raise HTTPException(status_code=400, detail="Provide order_id or transaction_id")
    tx = None
    order = None
    if transaction_id:
        result = await db.execute(select(PaymentTransaction).where(PaymentTransaction.id == transaction_id))
        tx = result.scalar_one_or_none()
        if not tx or tx.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Transaction not found")
        if tx.order_id:
            order_result = await db.execute(select(Order).where(Order.id == tx.order_id))
            order = order_result.scalar_one_or_none()
    else:
        result = await db.execute(select(Order).where(Order.id == order_id, Order.user_id == current_user.id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        tx_result = await db.execute(
            select(PaymentTransaction).where(PaymentTransaction.order_id == order.id).order_by(PaymentTransaction.created_at.desc()).limit(1)
        )
        tx = tx_result.scalar_one_or_none()
    return {
        "transaction_id": str(tx.id) if tx else None,
        "transaction_status": tx.status if tx else None,
        "order_id": str(order.id) if order else None,
        "order_status": order.status if order else None,
    }
