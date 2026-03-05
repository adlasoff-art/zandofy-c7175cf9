"""Abonnements vendeurs — plans (tiers), mon abo (spec: Store, VendorSubscription)."""
from datetime import datetime
from uuid import UUID, uuid4
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user, RequireVendor
from app.models.profile import Profile
from app.models.store import Store
from app.models.vendor import VendorSubscription
from app.services.email_service import send_email

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# Plans statiques (tiers) — à remplacer par subscription_plans en DB si besoin
PLANS = [
    {"id": "beginner", "name": "beginner", "display_name": "Débutant", "max_products": 10, "price": "0"},
    {"id": "growth", "name": "growth", "display_name": "Croissance", "max_products": 100, "price": "19.99"},
    {"id": "pro", "name": "pro", "display_name": "Pro", "max_products": 500, "price": "49.99"},
]


class PlanOut(BaseModel):
    id: str
    name: str
    display_name: str
    max_products: int
    price: str


class SubscriptionOut(BaseModel):
    id: UUID
    tier: str
    max_products: int
    is_whatsapp_enabled: bool
    can_self_deliver: bool
    paid_until: datetime | None


@router.get("/plans", response_model=list[PlanOut])
async def list_plans():
    return [PlanOut(**p) for p in PLANS]


@router.get("/my", response_model=SubscriptionOut | None)
async def my_subscription(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
):
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        return None
    result = await db.execute(select(VendorSubscription).where(VendorSubscription.store_id == store.id))
    sub = result.scalar_one_or_none()
    if not sub:
        sub = VendorSubscription(
            id=uuid4(),
            store_id=store.id,
            tier="beginner",
            max_products=10,
        )
        db.add(sub)
        await db.flush()
        await db.refresh(sub)
    return SubscriptionOut(
        id=sub.id,
        tier=sub.tier,
        max_products=sub.max_products,
        is_whatsapp_enabled=sub.is_whatsapp_enabled,
        can_self_deliver=sub.can_self_deliver,
        paid_until=sub.paid_until,
    )


@router.post("/remind-expiration")
async def remind_expiration(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(RequireVendor)],
):
    """Envoie un email de rappel si paid_until proche (appel manuel ou job)."""
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    store = store_result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    result = await db.execute(select(VendorSubscription).where(VendorSubscription.store_id == store.id))
    sub = result.scalar_one_or_none()
    if not sub or not sub.paid_until:
        raise HTTPException(status_code=404, detail="No subscription with expiry")
    html = f"<p>Votre abonnement vendeur ({sub.tier}) expire le {sub.paid_until.date()}.</p><p>Renouvelez pour continuer à vendre.</p>"
    await send_email(current_user.email, "Rappel expiration abonnement Zandofy", html)
    return {"sent": True}
