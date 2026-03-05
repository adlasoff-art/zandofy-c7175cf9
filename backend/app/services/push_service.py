"""Notifications push Web (VAPID)."""
import json
import logging
from typing import Any

from pywebpush import webpush, WebPushException

from app.config import settings

logger = logging.getLogger(__name__)


def get_vapid_claims() -> dict:
    return {
        "sub": "mailto:admin@zandofy.com",
    }


def send_push(subscription_info: dict, payload: dict[str, Any]) -> bool:
    """
    subscription_info: {endpoint, keys: {p256dh, auth}}
    payload: {title, body, url?, data?}
    """
    if not settings.vapid_private_key:
        logger.warning("VAPID private key not set")
        return False
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims=get_vapid_claims(),
        )
        return True
    except WebPushException as e:
        logger.warning("WebPush failed: %s", e)
        return False


async def send_push_async(subscription_info: dict, payload: dict[str, Any]) -> bool:
    """Version async (pywebpush est sync; on peut lancer en thread si besoin)."""
    return send_push(subscription_info, payload)
