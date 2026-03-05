"""Génération sitemap XML dynamique (produits, catégories, boutiques, pages CMS)."""
from datetime import datetime, timezone
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.category import Category
from app.models.store import Store
from app.models.cms import CmsPage


def _url_element(parent: Element, loc: str, lastmod: datetime | None = None, changefreq: str = "weekly", priority: float = 0.8):
    url = SubElement(parent, "url")
    SubElement(url, "loc").text = loc
    if lastmod:
        SubElement(url, "lastmod").text = lastmod.strftime("%Y-%m-%d")
    SubElement(url, "changefreq").text = changefreq
    SubElement(url, "priority").text = str(priority)


async def generate_sitemap_xml(db: AsyncSession, base_url: str) -> str:
    """Génère le XML du sitemap. base_url ex: https://zandofy.com."""
    base_url = base_url.rstrip("/")
    urlset = Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    _url_element(urlset, f"{base_url}/", datetime.now(timezone.utc), "daily", 1.0)

    cats = await db.execute(select(Category))
    for c in cats.scalars().all():
        _url_element(urlset, f"{base_url}/category/{c.id}", c.created_at, "weekly", 0.9)

    stores = await db.execute(select(Store))
    for s in stores.scalars().all():
        _url_element(urlset, f"{base_url}/store/{s.id}", s.updated_at, "weekly", 0.8)

    products = await db.execute(select(Product).where(Product.publish_status == "published"))
    for p in products.scalars().all():
        _url_element(urlset, f"{base_url}/product/{p.id}", p.updated_at, "weekly", 0.7)

    pages = await db.execute(select(CmsPage).where(CmsPage.is_published == True))
    for pg in pages.scalars().all():
        _url_element(urlset, f"{base_url}/page/{pg.slug}", pg.updated_at, "monthly", 0.6)

    rough = tostring(urlset, encoding="unicode", default_namespace="")
    return minidom.parseString(rough).toprettyxml(indent="  ")
