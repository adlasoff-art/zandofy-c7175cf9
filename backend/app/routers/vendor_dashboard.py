"""Dashboard vendeur — commandes, ventes, produits, stats (spec: Profile, Store)."""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user, RequireVendor
from app.models.profile import Profile
from app.models.store import Store
from app.models.order import Order, OrderItem
from app.models.product import Product

router = APIRouter(prefix="/vendor", tags=["vendor-dashboard"])


class DashboardStatsOut(BaseModel):
    orders_count: int
    orders_pending: int
    sales_total: str
    sales_period: str
    products_count: int
    products_published: int


class OrderSummaryOut(BaseModel):
    id: str
    order_ref: str
    status: str
    total: str
    created_at: datetime


@router.get("/dashboard", response_model=DashboardStatsOut)
async def get_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
    period_days: int = Query(30, ge=1, le=365),
):
    """Stats agrégées pour la boutique du vendeur."""
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        return DashboardStatsOut(
            orders_count=0,
            orders_pending=0,
            sales_total="0",
            sales_period="0",
            products_count=0,
            products_published=0,
        )

    since = datetime.now(timezone.utc) - timedelta(days=period_days)

    orders_count_result = await db.execute(
        select(func.count(Order.id)).where(Order.store_id == store.id)
    )
    orders_count = orders_count_result.scalar() or 0

    orders_pending_result = await db.execute(
        select(func.count(Order.id)).where(Order.store_id == store.id, Order.status == "pending")
    )
    orders_pending = orders_pending_result.scalar() or 0

    sales_result = await db.execute(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.store_id == store.id,
            Order.status.in_(["confirmed", "processing", "shipped", "delivered"]),
            Order.created_at >= since,
        )
    )
    sales_period_val = sales_result.scalar() or Decimal("0")

    sales_all_result = await db.execute(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.store_id == store.id,
            Order.status.in_(["confirmed", "processing", "shipped", "delivered"]),
        )
    )
    sales_total_val = sales_all_result.scalar() or Decimal("0")

    products_result = await db.execute(select(func.count(Product.id)).where(Product.store_id == store.id))
    products_count = products_result.scalar() or 0

    products_pub_result = await db.execute(
        select(func.count(Product.id)).where(Product.store_id == store.id, Product.publish_status == "published")
    )
    products_published = products_pub_result.scalar() or 0

    return DashboardStatsOut(
        orders_count=orders_count,
        orders_pending=orders_pending,
        sales_total=str(sales_total_val),
        sales_period=str(sales_period_val),
        products_count=products_count,
        products_published=products_published,
    )


@router.get("/orders", response_model=list[OrderSummaryOut])
async def list_vendor_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Liste des commandes de la boutique."""
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        return []
    q = select(Order).where(Order.store_id == store.id).order_by(Order.created_at.desc())
    if status:
        q = q.where(Order.status == status)
    result = await db.execute(q.offset(offset).limit(limit))
    orders = result.scalars().all()
    return [
        OrderSummaryOut(id=str(o.id), order_ref=o.order_ref, status=o.status, total=str(o.total), created_at=o.created_at)
        for o in orders
    ]


@router.get("/products", response_model=list[dict])
async def list_vendor_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
    publish_status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Liste des produits de la boutique."""
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        return []
    q = select(Product).where(Product.store_id == store.id).order_by(Product.created_at.desc())
    if publish_status:
        q = q.where(Product.publish_status == publish_status)
    result = await db.execute(q.offset(offset).limit(limit))
    products = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "name_fr": p.name_fr,
            "price": str(p.price),
            "publish_status": p.publish_status,
            "stock_quantity": p.stock_quantity,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in products
    ]
