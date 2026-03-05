"""Admin CMS — bannières, sections homepage, menu, pages, popups (spec)."""
from datetime import datetime
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import RequireAdmin
from app.models.profile import Profile
from app.models.cms import CmsBanner, CmsHomepageSection, CmsMenuItem, CmsPage, CmsPopup

router = APIRouter(prefix="/admin/cms", tags=["admin-cms"])


# --- Banners ---
class CmsBannerIn(BaseModel):
    title: str
    subtitle: str | None = None
    image_url: str | None = None
    link: str | None = None
    cta: str | None = None
    position: str = "hero"
    sort_order: int = 0
    is_active: bool = True


@router.get("/banners")
async def list_banners(db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(CmsBanner).order_by(CmsBanner.sort_order, CmsBanner.created_at.desc()))
    return [{"id": str(b.id), "title": b.title, "position": b.position, "is_active": b.is_active, "sort_order": b.sort_order} for b in result.scalars().all()]


@router.post("/banners")
async def create_banner(data: CmsBannerIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    b = CmsBanner(**data.model_dump())
    db.add(b)
    await db.flush()
    await db.refresh(b)
    return {"id": str(b.id)}


@router.patch("/banners/{banner_id}")
async def update_banner(banner_id: UUID, data: CmsBannerIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(CmsBanner).where(CmsBanner.id == banner_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")
    for k, v in data.model_dump().items():
        setattr(b, k, v)
    await db.flush()
    return {"id": str(b.id)}


@router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: UUID, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(CmsBanner).where(CmsBanner.id == banner_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")
    await db.delete(b)
    await db.flush()
    return {"deleted": str(banner_id)}


# --- Homepage sections ---
class CmsSectionIn(BaseModel):
    section_key: str
    label: str
    config: dict = {}
    sort_order: int = 0
    is_active: bool = True


@router.get("/sections")
async def list_sections(db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(CmsHomepageSection).order_by(CmsHomepageSection.sort_order))
    return [{"id": str(s.id), "section_key": s.section_key, "label": s.label, "is_active": s.is_active} for s in result.scalars().all()]


@router.post("/sections")
async def create_section(data: CmsSectionIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    s = CmsHomepageSection(**data.model_dump())
    db.add(s)
    await db.flush()
    return {"id": str(s.id)}


# --- Menu items ---
class CmsMenuItemIn(BaseModel):
    label: str
    url: str = ""
    menu_group: str = "main"
    sort_order: int = 0
    is_visible: bool = True


@router.get("/menu")
async def list_menu(db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(CmsMenuItem).order_by(CmsMenuItem.menu_group, CmsMenuItem.sort_order))
    return [{"id": str(m.id), "label": m.label, "url": m.url, "menu_group": m.menu_group} for m in result.scalars().all()]


@router.post("/menu")
async def create_menu_item(data: CmsMenuItemIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    m = CmsMenuItem(**data.model_dump())
    db.add(m)
    await db.flush()
    return {"id": str(m.id)}


# --- Pages ---
class CmsPageIn(BaseModel):
    slug: str
    title: str
    content: str = ""
    is_published: bool = False


@router.get("/pages")
async def list_pages(db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(CmsPage).order_by(CmsPage.slug))
    return [{"id": str(p.id), "slug": p.slug, "title": p.title, "is_published": p.is_published} for p in result.scalars().all()]


@router.post("/pages")
async def create_page(data: CmsPageIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    existing = await db.execute(select(CmsPage).where(CmsPage.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slug already exists")
    p = CmsPage(**data.model_dump())
    db.add(p)
    await db.flush()
    return {"id": str(p.id)}


@router.patch("/pages/{page_id}")
async def update_page(page_id: UUID, data: CmsPageIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(CmsPage).where(CmsPage.id == page_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    await db.flush()
    return {"id": str(p.id)}


# --- Popups ---
class CmsPopupIn(BaseModel):
    title: str
    content: str = ""
    image_url: str | None = None
    link: str | None = None
    link_label: str | None = None
    display_frequency: str = "once"
    start_date: datetime | None = None
    end_date: datetime | None = None
    is_active: bool = True


@router.get("/popups")
async def list_popups(db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(CmsPopup).order_by(CmsPopup.created_at.desc()))
    return [{"id": str(p.id), "title": p.title, "is_active": p.is_active} for p in result.scalars().all()]


@router.post("/popups")
async def create_popup(data: CmsPopupIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    p = CmsPopup(**data.model_dump())
    db.add(p)
    await db.flush()
    return {"id": str(p.id)}
