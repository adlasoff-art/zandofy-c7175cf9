"""Produits — liste et détail (spec Zandofy)."""
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.product import Product, ProductImage, ProductColor, ProductSize

router = APIRouter(prefix="/products", tags=["products"])


class ProductImageOut(BaseModel):
    id: UUID
    image_url: str
    position: int | None

    model_config = {"from_attributes": True}


class ProductListOut(BaseModel):
    id: UUID
    name: str
    name_fr: str
    price: float
    currency: str
    discount: float
    is_sale: bool
    is_new: bool
    publish_status: str
    rating: float
    review_count: int

    model_config = {"from_attributes": True}


class ProductDetailOut(BaseModel):
    id: UUID
    store_id: UUID | None
    category_id: UUID | None
    name: str
    name_fr: str
    description: str | None
    short_description: str | None
    price: float
    original_price: float | None
    currency: str
    discount: float
    is_sale: bool
    is_new: bool
    moq: int
    sku: str | None
    stock_quantity: int | None
    publish_status: str
    rating: float
    review_count: int
    images: list[ProductImageOut] = []
    colors: list[dict] = []
    sizes: list[dict] = []

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ProductListOut])
async def list_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    category_id: UUID | None = Query(None),
    store_id: UUID | None = Query(None),
    publish_status: str = Query("published", description="draft | published"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    q = select(Product).where(Product.publish_status == publish_status)
    if category_id is not None:
        q = q.where(Product.category_id == category_id)
    if store_id is not None:
        q = q.where(Product.store_id == store_id)
    q = q.order_by(Product.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.get("/{product_id}", response_model=ProductDetailOut)
async def get_product(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.publish_status != "published":
        raise HTTPException(status_code=404, detail="Product not found")
    img_result = await db.execute(select(ProductImage).where(ProductImage.product_id == product_id).order_by(ProductImage.position))
    images = img_result.scalars().all()
    color_result = await db.execute(select(ProductColor).where(ProductColor.product_id == product_id))
    colors = [{"color_hex": c.color_hex, "color_name": c.color_name} for c in color_result.scalars().all()]
    size_result = await db.execute(select(ProductSize).where(ProductSize.product_id == product_id))
    sizes = [{"size_label": s.size_label, "region": s.region} for s in size_result.scalars().all()]
    return ProductDetailOut(
        **{k: getattr(product, k) for k in ProductDetailOut.model_fields if k not in ("images", "colors", "sizes")},
        images=[ProductImageOut.model_validate(i) for i in images],
        colors=colors,
        sizes=sizes,
    )
