"""Commandes — liste, détail, mise à jour statut (spec: profiles, stores)."""
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user, RequireVendor
from app.models.profile import Profile
from app.models.store import Store
from app.models.order import Order, OrderItem
from app.services.email_service import send_order_confirmation, send_order_shipped, send_order_delivered, send_vendor_new_order

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderStatusUpdate(BaseModel):
    status: str  # confirmed, processing, shipped, delivered, cancelled


@router.get("/my")
async def my_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
    limit: int = 20,
):
    result = await db.execute(
        select(Order).where(Order.user_id == current_user.id).order_by(Order.created_at.desc()).limit(limit)
    )
    orders = result.scalars().all()
    return {"orders": [{"id": str(o.id), "status": o.status, "total": str(o.total), "created_at": o.created_at} for o in orders]}


@router.get("/{order_id}")
async def order_detail(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
    items = items_result.scalars().all()
    return {
        "id": str(order.id),
        "status": order.status,
        "total": str(order.total),
        "shipping_cost": str(order.shipping_cost or 0),
        "items": [{"product_id": str(i.product_id), "quantity": i.quantity, "price": str(i.price)} for i in items],
    }


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: UUID,
    data: OrderStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store or order.store_id != store.id:
        raise HTTPException(status_code=403, detail="Not your store order")
    order.status = data.status
    if data.status == "shipped":
        from app.models.profile import Profile
        prof_result = await db.execute(select(Profile).where(Profile.id == order.user_id))
        prof = prof_result.scalar_one_or_none()
        if prof:
            await send_order_shipped(prof.email, str(order.id)[:8], tracking_url=None)
    elif data.status == "delivered":
        from datetime import datetime, timezone
        if hasattr(order, "delivered_at"):
            order.delivered_at = datetime.now(timezone.utc)
        prof_result = await db.execute(select(Profile).where(Profile.id == order.user_id))
        prof = prof_result.scalar_one_or_none()
        if prof:
            await send_order_delivered(prof.email, str(order.id)[:8])
    await db.flush()
    return {"status": order.status}
