"""Client API Kelpay — initiation paiement, vérification statut (Mobile Money + carte)."""
import hashlib
import hmac
import logging
from typing import Any
import httpx

from app.config import settings

logger = logging.getLogger(__name__)
HTTP_TIMEOUT = 30.0
MAX_RETRIES = 2


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.kelpay_token}",
        "Content-Type": "application/json",
    }


async def initiate_payment(
    order_id: str,
    amount: float,
    currency: str = "XAF",
    customer_email: str | None = None,
    customer_phone: str | None = None,
    payment_method: str = "mobile_money",  # mobile_money, card, orange, airtel, mpesa
    callback_url: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Initie un paiement Kelpay. Retourne redirect_url ou payment_id selon le provider."""
    url = f"{settings.kelpay_base_url.rstrip('/')}/payments"
    payload = {
        "merchant_code": settings.kelpay_merchant_code,
        "order_id": order_id,
        "amount": amount,
        "currency": currency,
        "payment_method": payment_method,
        "callback_url": callback_url or "",
        "customer": {
            "email": customer_email or "",
            "phone": customer_phone or "",
        },
        "metadata": metadata or {},
    }
    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=_headers(), timeout=HTTP_TIMEOUT)
                resp.raise_for_status()
                return resp.json()
        except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
            if attempt < MAX_RETRIES:
                logger.warning("KelPay initiate_payment attempt %s failed, retrying: %s", attempt + 1, e)
            else:
                raise


async def check_payment_status(provider_reference: str) -> dict[str, Any]:
    """Vérifie le statut d'un paiement via l'API Kelpay."""
    url = f"{settings.kelpay_base_url.rstrip('/')}/payments/{provider_reference}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_headers(), timeout=15.0)
        resp.raise_for_status()
        return resp.json()


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Vérifie la signature du webhook Kelpay (HMAC)."""
    if not settings.kelpay_webhook_secret:
        return False
    expected = hmac.new(
        settings.kelpay_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
