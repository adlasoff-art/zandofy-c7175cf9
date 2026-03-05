"""Emails transactionnels — envoi confirmation, reset password, newsletter opt-in (spec)."""
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.profile import Profile
from app.services.email_service import (
    send_order_confirmation,
    send_password_reset,
    send_newsletter_welcome,
)

router = APIRouter(prefix="/email", tags=["email"])


class PasswordResetRequest(BaseModel):
    email: EmailStr
    reset_link: str  # en prod: généré côté backend avec token


class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    unsubscribe_link: str


@router.post("/send-order-confirmation")
async def api_send_order_confirmation(
    order_id: UUID,
    to_email: EmailStr,
    order_number: str,
    total: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
    items_summary: str = "",
):
    ok = await send_order_confirmation(to_email, order_number, total, items_summary)
    return {"sent": ok}


@router.post("/password-reset")
async def api_password_reset(data: PasswordResetRequest):
    ok = await send_password_reset(data.email, data.reset_link)
    return {"sent": ok}


@router.post("/newsletter/subscribe")
async def api_newsletter_subscribe(data: NewsletterSubscribeRequest):
    ok = await send_newsletter_welcome(data.email, data.unsubscribe_link)
    return {"subscribed": ok}
