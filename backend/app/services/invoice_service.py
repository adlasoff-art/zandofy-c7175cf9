"""Génération factures PDF + upload bucket (Supabase Storage)."""
import io
import logging
from datetime import datetime
from decimal import Decimal
from uuid import UUID

import httpx
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from app.config import settings

logger = logging.getLogger(__name__)


def generate_invoice_pdf(
    order_id: str,
    order_number: str,
    created_at: datetime,
    items: list[dict],
    total: Decimal,
    shipping: Decimal,
    currency: str = "XAF",
    billing_address: dict | None = None,
    logo_url: str | None = None,
) -> bytes:
    """Génère le PDF en mémoire. items: [{"name", "qty", "unit_price", "total"}], billing_address: {name, address, city, ...}."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=40, bottomMargin=30)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=18)
    flow = []
    flow.append(Paragraph("Facture", title_style))
    flow.append(Spacer(1, 12))
    flow.append(Paragraph(f"Commande # {order_number}", styles["Normal"]))
    flow.append(Paragraph(f"Date : {created_at.strftime('%d/%m/%Y %H:%M')}", styles["Normal"]))
    if billing_address:
        flow.append(Spacer(1, 12))
        flow.append(Paragraph(f"Facturé à : {billing_address.get('name', '')}", styles["Normal"]))
        flow.append(Paragraph(billing_address.get("address", ""), styles["Normal"]))
        flow.append(Paragraph(f"{billing_address.get('city', '')} {billing_address.get('postal_code', '')}", styles["Normal"]))
    flow.append(Spacer(1, 20))
    data = [["Produit", "Qté", "Prix unit.", "Total"]]
    for it in items:
        data.append([it.get("name", ""), str(it.get("qty", 0)), str(it.get("unit_price", "")), str(it.get("total", ""))])
    data.append(["", "", "Livraison", str(shipping)])
    data.append(["", "", "TOTAL TTC", str(total)])
    t = Table(data, colWidths=[200, 40, 80, 80])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("BACKGROUND", (0, -2), (-1, -1), colors.beige),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
    ]))
    flow.append(t)
    doc.build(flow)
    return buf.getvalue()


async def upload_invoice_to_storage(file_bytes: bytes, filename: str, content_type: str = "application/pdf") -> str | None:
    """Upload vers Supabase Storage (si configuré). Retourne l'URL publique ou None."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase storage not configured")
        return None
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{settings.storage_bucket}/{filename}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": content_type,
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, content=file_bytes, headers=headers, timeout=30.0)
            resp.raise_for_status()
            return url
    except Exception as e:
        logger.exception("Upload invoice failed: %s", e)
        return None
