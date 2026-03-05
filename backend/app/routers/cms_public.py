"""CMS public — bannières, sections, menu, pages (lecture seule, pas d'auth)."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.cms import CmsBanner, CmsHomepageSection, CmsMenuItem, CmsPage, CmsPopup

router = APIRouter(prefix="/cms", tags=["cms-public"])


@router.get("/banners")
async def list_banners_public(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CmsBanner).where(CmsBanner.is_active == True).order_by(CmsBanner.sort_order, CmsBanner.created_at.desc())
    )
    return [
        {"id": str(b.id), "title": b.title, "subtitle": b.subtitle, "image_url": b.image_url, "link": b.link, "cta": b.cta, "position": b.position}
        for b in result.scalars().all()
    ]


@router.get("/sections")
async def list_sections_public(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CmsHomepageSection).where(CmsHomepageSection.is_active == True).order_by(CmsHomepageSection.sort_order)
    )
    return [{"id": str(s.id), "section_key": s.section_key, "label": s.label, "config": s.config} for s in result.scalars().all()]


@router.get("/menu")
async def list_menu_public(db: AsyncSession = Depends(get_db), menu_group: str | None = None):
    q = select(CmsMenuItem).where(CmsMenuItem.is_visible == True).order_by(CmsMenuItem.menu_group, CmsMenuItem.sort_order)
    if menu_group:
        q = q.where(CmsMenuItem.menu_group == menu_group)
    result = await db.execute(q)
    return [{"id": str(m.id), "label": m.label, "url": m.url, "menu_group": m.menu_group} for m in result.scalars().all()]


@router.get("/pages/{slug}")
async def get_page_public(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CmsPage).where(CmsPage.slug == slug, CmsPage.is_published == True))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"id": str(page.id), "slug": page.slug, "title": page.title, "content": page.content}


@router.get("/popups")
async def list_popups_public(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(CmsPopup).where(
            CmsPopup.is_active == True,
            (CmsPopup.start_date.is_(None)) | (CmsPopup.start_date <= now),
            (CmsPopup.end_date.is_(None)) | (CmsPopup.end_date >= now),
        ).order_by(CmsPopup.created_at.desc())
    )
    return [{"id": str(p.id), "title": p.title, "content": p.content, "image_url": p.image_url, "link": p.link, "link_label": p.link_label, "display_frequency": p.display_frequency} for p in result.scalars().all()]
