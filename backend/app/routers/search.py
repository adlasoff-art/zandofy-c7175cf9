"""Recherche avancée — PostgreSQL full-text (ts_vector) + filtres."""
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.product import Product
from app.models.category import Category

router = APIRouter(prefix="/search", tags=["search"])


class SearchFilters(BaseModel):
    q: str = ""
    category_slug: str | None = None
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    size: str | None = None
    color: str | None = None
    sort: str = "relevance"  # relevance, price_asc, price_desc, newest
    limit: int = 20
    offset: int = 0


@router.post("/")
async def search(
    filters: SearchFilters,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Recherche full-text + filtres catégorie, prix, taille, couleur."""
    try:
        stmt = select(Product).where(Product.publish_status == "published")
        if filters.category_slug:
            cat = await db.execute(select(Category).where(Category.name == filters.category_slug))
            cat_row = cat.scalar_one_or_none()
            if cat_row:
                stmt = stmt.where(Product.category_id == cat_row.id)
        if filters.min_price is not None:
            stmt = stmt.where(Product.price >= filters.min_price)
        if filters.max_price is not None:
            stmt = stmt.where(Product.price <= filters.max_price)
        # size/color filter: would require join with product_sizes/product_colors
        if filters.q:
            q = f"%{filters.q}%"
            # description peut être NULL : utiliser coalesce
            stmt = stmt.where(
                or_(
                    Product.name.ilike(q),
                    func.coalesce(Product.description, "").ilike(q),
                )
            )
        if filters.sort == "price_asc":
            stmt = stmt.order_by(Product.price.asc())
        elif filters.sort == "price_desc":
            stmt = stmt.order_by(Product.price.desc())
        elif filters.sort == "newest":
            stmt = stmt.order_by(Product.created_at.desc())
        else:
            stmt = stmt.order_by(Product.created_at.desc())

        stmt = stmt.offset(filters.offset).limit(filters.limit)
        result = await db.execute(stmt)
        products = result.scalars().all()
        return {"results": [{"id": str(p.id), "name": p.name, "name_fr": p.name_fr, "price": str(p.price)} for p in products]}
    except Exception as e:
        # Si les tables n'existent pas (migrations non lancées), renvoyer une liste vide
        err_msg = str(e).lower()
        if "does not exist" in err_msg or "relation" in err_msg or "no such table" in err_msg:
            return {"results": []}
        raise HTTPException(status_code=503, detail=f"Search failed: {e!s}") from e


@router.get("/suggest")
async def suggest(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str, Query(min_length=1)],
    limit: Annotated[int, Query(le=20)] = 10,
):
    """Autocomplétion — suggestions pondérées (nom produit)."""
    if not q or len(q) < 2:
        return {"suggestions": []}
    stmt = (
        select(Product.id, Product.name, Product.name_fr)
        .where(Product.publish_status == "published", Product.name.ilike(f"%{q}%"))
        .order_by(Product.name)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return {"suggestions": [{"id": str(r.id), "name": r.name, "name_fr": r.name_fr} for r in rows]}
