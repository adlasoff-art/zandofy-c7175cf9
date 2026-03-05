"""Webhook KelPay — confirmation de paiement → orders.status = confirmed (spec)."""
from typing import Annotated

from fastapi import APIRouter, Request, HTTPException, Header, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.services.kelpay import verify_webhook_signature
from app.models.payment import PaymentTransaction
from app.models.order import Order
from app.models.profile import Profile
from app.services.email_service import send_order_confirmation
from app.routers.ws import get_ws_manager

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/kelpay")
async def kelpay_callback(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_kelpay_signature: str | None = Header(None),
):
    body = await request.body()
    # En production, exiger un secret et rejeter toute requête non signée (évite abus)
    if settings.kelpay_webhook_secret:
        if not x_kelpay_signature:
            raise HTTPException(status_code=403, detail="Missing webhook signature")
        if not verify_webhook_signature(body, x_kelpay_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    data = await request.json()
    ref = data.get("payment_id") or data.get("reference") or data.get("id")
    status_value = (data.get("status") or "").lower()

    if not ref:
        raise HTTPException(status_code=400, detail="Missing reference")

    result = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.transaction_id == str(ref))
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if status_value in ("completed", "success", "paid"):
        tx.status = "completed"
        tx.callback_payload = {**(tx.callback_payload or {}), "webhook": data}
        if tx.order_id:
            order_result = await db.execute(select(Order).where(Order.id == tx.order_id))
            order = order_result.scalar_one_or_none()
            if order and order.status == "pending":
                order.status = "confirmed"
                profile_result = await db.execute(select(Profile).where(Profile.id == order.user_id))
                profile = profile_result.scalar_one_or_none()
                if profile:
                    await send_order_confirmation(
                        profile.email,
                        order.order_ref,
                        str(order.total),
                        "",
                    )
                ws_manager = get_ws_manager()
                await ws_manager.send_personal(order.user_id, {"type": "order_confirmed", "order_id": str(order.id), "order_ref": order.order_ref})
        await db.flush()
        return {"ok": True, "order_status": "confirmed"}
    elif status_value in ("failed", "cancelled"):
        tx.status = "failed"
        await db.flush()
        return {"ok": True}

    return {"ok": True}
