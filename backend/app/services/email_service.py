"""Envoi d'emails transactionnels (SMTP) avec templates HTML."""
import logging
from pathlib import Path

import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import settings

logger = logging.getLogger(__name__)
_templates_dir = Path(__file__).resolve().parent.parent / "templates" / "email"
_env = Environment(
    loader=FileSystemLoader(_templates_dir) if _templates_dir.exists() else None,
    autoescape=select_autoescape(["html"]),
)


def _render(template_name: str, **context) -> str:
    if _env.loader is None:
        return f"<p>{context}</p>"
    t = _env.get_template(template_name)
    return t.render(**context)


async def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    if not settings.smtp_host:
        # Ne pas logger l'adresse email (RGPD / minimisation des données)
        logger.warning("SMTP not configured, skipping transactional email")
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = to
    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            use_tls=settings.smtp_tls,
            timeout=30,
        )
        return True
    except Exception as e:
        logger.exception("Send email failed: %s", e)
        return False


async def send_order_confirmation(to: str, order_number: str, total: str, items_summary: str) -> bool:
    html = _render(
        "order_confirmation.html",
        order_number=order_number,
        total=total,
        items_summary=items_summary,
    )
    return await send_email(to, f"Confirmation de commande #{order_number}", html)


async def send_order_shipped(to: str, order_number: str, tracking_url: str | None = None) -> bool:
    html = _render("order_shipped.html", order_number=order_number, tracking_url=tracking_url or "")
    return await send_email(to, f"Votre commande #{order_number} a été expédiée", html)


async def send_order_delivered(to: str, order_number: str) -> bool:
    html = _render("order_delivered.html", order_number=order_number)
    return await send_email(to, f"Commande #{order_number} livrée", html)


async def send_password_reset(to: str, reset_link: str, expires_minutes: int = 60) -> bool:
    html = _render("password_reset.html", reset_link=reset_link, expires_minutes=expires_minutes)
    return await send_email(to, "Réinitialisation de votre mot de passe — Zandofy", html)


async def send_vendor_new_order(to: str, order_number: str, shop_name: str) -> bool:
    html = _render("vendor_new_order.html", order_number=order_number, shop_name=shop_name)
    return await send_email(to, f"Nouvelle commande #{order_number} sur {shop_name}", html)


async def send_newsletter_welcome(to: str, unsubscribe_link: str) -> bool:
    html = _render("newsletter_welcome.html", unsubscribe_link=unsubscribe_link)
    return await send_email(to, "Bienvenue dans la newsletter Zandofy", html)
