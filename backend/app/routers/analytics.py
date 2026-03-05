"""Analytics et rapports — CA, commandes, utilisateurs (admin) ; ventes vendeur (seller) ; export CSV."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import io
import csv

from app.database import get_db
from app.middleware.auth import get_current_user, RequireAdmin, require_roles
from app.models.profile import Profile, AppRole
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.store import Store

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/admin/dashboard")
async def admin_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
):
    """Métriques admin: CA, commandes, nouveaux utilisateurs."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    # CA
    ca_result = await db.execute(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.created_at >= since,
            Order.status.in_(["confirmed", "processing", "shipped", "delivered"]),
        )
    )
    ca = ca_result.scalar() or Decimal("0")
    # Nombre de commandes
    orders_result = await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= since)
    )
    orders_count = orders_result.scalar() or 0
    users_result = await db.execute(select(func.count(Profile.id)).where(Profile.created_at >= since))
    new_users = users_result.scalar() or 0
    return {
        "revenue": str(ca),
        "orders_count": orders_count,
        "new_users": new_users,
        "period_days": days,
    }


RequireSeller = require_roles(AppRole.admin, AppRole.manager, AppRole.vendor)


@router.get("/seller/reports")
async def seller_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireSeller)],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
):
    """Rapports vendeur: ventes, produits populaires, taux conversion (simplifié)."""
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        return {"sales": 0, "orders_count": 0, "top_products": []}
    since = datetime.now(timezone.utc) - timedelta(days=days)
    # Ventes du store
    sales_result = await db.execute(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.store_id == store.id,
            Order.created_at >= since,
            Order.status.in_(["confirmed", "processing", "shipped", "delivered"]),
        )
    )
    sales = sales_result.scalar() or Decimal("0")
    orders_count_result = await db.execute(
        select(func.count(Order.id)).where(Order.store_id == store.id, Order.created_at >= since)
    )
    orders_count = orders_count_result.scalar() or 0
    # Top produits : agrégation OrderItem par product_id (commandes livrées/confirmées du store)
    top_q = (
        select(
            OrderItem.product_id,
            OrderItem.product_name,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("total_quantity"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.store_id == store.id,
            Order.created_at >= since,
            Order.status.in_(["confirmed", "processing", "shipped", "delivered"]),
            OrderItem.product_id.isnot(None),
        )
        .group_by(OrderItem.product_id, OrderItem.product_name)
        .order_by(func.coalesce(func.sum(OrderItem.quantity), 0).desc())
        .limit(20)
    )
    top_result = await db.execute(top_q)
    top_rows = top_result.all()
    top_products = [
        {
            "product_id": str(r.product_id),
            "product_name": r.product_name,
            "total_quantity_sold": int(r.total_quantity),
        }
        for r in top_rows
    ]
    return {
        "sales": str(sales),
        "orders_count": orders_count,
        "top_products": top_products,
    }


@router.get("/admin/export/csv")
async def export_csv(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireAdmin)],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
):
    """Export CSV des commandes (admin)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Order).where(Order.created_at >= since).order_by(Order.created_at.desc()).limit(10000)
    )
    orders = result.scalars().all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "user_id", "status", "total", "created_at"])
    for o in orders:
        w.writerow([str(o.id), str(o.user_id), o.status, str(o.total), o.created_at.isoformat() if o.created_at else ""])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders_export.csv"},
    )
