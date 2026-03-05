"""Tâches Celery — envoi d'email asynchrone."""
import asyncio
import logging

from app.celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, name="zandofy.send_email")
def send_email_task(self, to: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    """Envoie un email de façon asynchrone (appel depuis API si besoin)."""
    try:
        from app.services.email_service import send_email
        return asyncio.run(send_email(to, subject, html_body, text_body))
    except Exception as e:
        logger.exception("send_email_task failed: %s", e)
        raise
