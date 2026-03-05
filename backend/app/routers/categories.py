"""Catégories — liste et détail (spec Zandofy)."""
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.category import Category

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryOut(BaseModel):
    id: UUID
    name: str
    name_fr: str
    icon: str | None
    image_url: str | None
    parent_id: UUID | None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    parent_id: UUID | None = Query(None, description="Filtrer par catégorie parente (null = racine)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    q = select(Category).order_by(Category.name)
    if parent_id is not None:
        q = q.where(Category.parent_id == parent_id)
    else:
        q = q.where(Category.parent_id.is_(None))
    result = await db.execute(q.offset(offset).limit(limit))
    return list(result.scalars().all())


@router.get("/{category_id}", response_model=CategoryOut)
async def get_category(
    category_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat
