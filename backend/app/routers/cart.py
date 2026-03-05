"""Panier — ajout, liste, mise à jour, suppression (spec Zandofy)."""
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.profile import Profile
from app.models.order import CartItem
from app.models.product import Product

router = APIRouter(prefix="/cart", tags=["cart"])


class CartItemIn(BaseModel):
    product_id: UUID
    quantity: int = 1
    size: str | None = None
    color: str | None = None


class CartItemOut(BaseModel):
    id: UUID
    product_id: UUID
    quantity: int
    size: str | None
    color: str | None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[CartItemOut])
async def get_cart(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    result = await db.execute(
        select(CartItem).where(CartItem.user_id == current_user.id).order_by(CartItem.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=CartItemOut, status_code=201)
async def add_to_cart(
    data: CartItemIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    if data.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")
    product_result = await db.execute(select(Product).where(Product.id == data.product_id, Product.publish_status == "published"))
    if not product_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")
    existing = await db.execute(
        select(CartItem).where(
            CartItem.user_id == current_user.id,
            CartItem.product_id == data.product_id,
            CartItem.size == data.size,
            CartItem.color == data.color,
        )
    )
    item = existing.scalar_one_or_none()
    if item:
        item.quantity += data.quantity
        await db.flush()
        await db.refresh(item)
        return item
    item = CartItem(
        user_id=current_user.id,
        product_id=data.product_id,
        quantity=data.quantity,
        size=data.size,
        color=data.color,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


class CartItemUpdate(BaseModel):
    quantity: int


@router.patch("/{item_id}", response_model=CartItemOut)
async def update_cart_item(
    item_id: UUID,
    data: CartItemUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    quantity = data.quantity
    if quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")
    result = await db.execute(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == current_user.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    item.quantity = quantity
    await db.flush()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def remove_cart_item(
    item_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    result = await db.execute(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == current_user.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    await db.delete(item)
    await db.flush()
