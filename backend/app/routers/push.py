"""Abonnements push et envoi (spec: profiles, push_subscriptions)."""
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.middleware.auth import get_current_user
from app.models.profile import Profile
from app.models.notification import PushSubscription
from app.services.push_service import send_push_async

router = APIRouter(prefix="/push", tags=["push"])


class SubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: str | None = None


@router.get("/vapid-public-key")
def get_vapid_public_key():
    return {"public_key": settings.vapid_public_key}


@router.post("/subscribe")
async def subscribe(
    data: SubscribeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    existing = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == data.endpoint,
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "already_subscribed"}
    sub = PushSubscription(
        user_id=current_user.id,
        endpoint=data.endpoint,
        p256dh=data.p256dh,
        auth=data.auth,
    )
    db.add(sub)
    await db.flush()
    return {"status": "subscribed"}


@router.post("/send-test")
async def send_test(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    result = await db.execute(select(PushSubscription).where(PushSubscription.user_id == current_user.id))
    subs = result.scalars().all()
    for s in subs:
        await send_push_async(
            {"endpoint": s.endpoint, "keys": {"p256dh": s.p256dh, "auth": s.auth}},
            {"title": "Zandofy", "body": "Test notification"},
        )
    return {"sent": len(subs)}
