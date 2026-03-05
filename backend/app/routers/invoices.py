"""Génération et téléchargement de factures PDF (spec: Profile, Order.total, OrderItem.price)."""
from decimal import Decimal
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.profile import Profile
from app.models.order import Order, OrderItem
from app.services.invoice_service import generate_invoice_pdf, upload_invoice_to_storage

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _items_data(order_items):
    return [
        {"name": i.product_name or "Article", "qty": i.quantity, "unit_price": str(i.price), "total": str(i.price * i.quantity)}
        for i in order_items
    ]


@router.get("/{order_id}/pdf")
async def get_invoice_pdf(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    """Retourne le PDF de la facture pour la commande (client ou admin)."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
    items = items_result.scalars().all()
    pdf_bytes = generate_invoice_pdf(
        order_id=str(order.id),
        order_number=order.order_ref,
        created_at=order.created_at,
        items=_items_data(items),
        total=order.total,
        shipping=order.shipping_cost or Decimal("0"),
        currency="USD",
        billing_address=None,
    )
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=facture.pdf"})


@router.post("/{order_id}/generate-and-store")
async def generate_and_store_invoice(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    """Génère le PDF, l'upload en bucket et retourne le lien de téléchargement."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
    items = items_result.scalars().all()
    pdf_bytes = generate_invoice_pdf(
        order_id=str(order.id),
        order_number=order.order_ref,
        created_at=order.created_at,
        items=_items_data(items),
        total=order.total,
        shipping=order.shipping_cost or Decimal("0"),
        currency="USD",
        billing_address=None,
    )
    filename = f"facture-{order.id}.pdf"
    url = await upload_invoice_to_storage(pdf_bytes, filename)
    return {"download_url": url, "filename": filename}
