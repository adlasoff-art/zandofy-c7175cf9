"""Libération des fonds en attente (retention_days). Appelée par CRON."""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wallet import Wallet, WalletTransaction
from app.models.order import Order
from app.models.shop import Shop
from app.config import settings

# Nombre de jours avant de libérer les fonds (configurable)
RETENTION_DAYS = 7


async def release_vendor_pending_funds(db: AsyncSession, retention_days: int | None = None) -> int:
    """
    Déplace les montants 'pending' éligibles vers le solde disponible.
    On considère les commandes delivered depuis au moins retention_days.
    Retourne le nombre de transactions créées.
    """
    days = retention_days or RETENTION_DAYS
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Option 1: utiliser une fonction PostgreSQL si elle existe (release_vendor_pending_funds)
    # Option 2: logique en Python
    result = await db.execute(
        select(Order)
        .where(Order.status == "delivered", Order.delivered_at <= cutoff, Order.shop_id.isnot(None))
    )
    orders = result.scalars().all()

    count = 0
    for order in orders:
        # Éviter double libération
        existing = await db.execute(
            select(WalletTransaction).where(
                WalletTransaction.order_id == order.id,
                WalletTransaction.type == "order_release",
            )
        )
        if existing.scalar_one_or_none():
            continue
        vendor_amount = order.total_amount - (order.shipping_amount or Decimal("0"))
        if vendor_amount <= 0:
            continue
        shop_result = await db.execute(select(Shop).where(Shop.id == order.shop_id))
        shop = shop_result.scalar_one_or_none()
        if not shop:
            continue
        wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == shop.owner_id))
        wallet = wallet_result.scalar_one_or_none()
        if not wallet:
            continue
        wallet.pending_balance -= vendor_amount
        wallet.balance += vendor_amount
        db.add(WalletTransaction(
            wallet_id=wallet.id,
            amount=vendor_amount,
            type="order_release",
            order_id=order.id,
            reference=f"order_{order.id}",
        ))
        count += 1

    await db.commit()
    return count
