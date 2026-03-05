"""Sitemap dynamique — produits, catégories, stores, pages CMS (spec)."""
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.services.sitemap_service import generate_sitemap_xml

router = APIRouter(prefix="/sitemap", tags=["sitemap"])


@router.get("/xml", response_class=Response)
async def get_sitemap(db: Annotated[AsyncSession, Depends(get_db)]):
    xml = await generate_sitemap_xml(db, settings.site_base_url)
    return Response(content=xml, media_type="application/xml")
