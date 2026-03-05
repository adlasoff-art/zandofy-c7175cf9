"""Recherche par image — GPT-4o Vision + mots-clés + recherche produits."""
import json
from decimal import Decimal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.product import Product, ProductImage
from app.schemas.support import (
    VisualSearchRequest,
    VisualSearchResponse,
    ExtractedKeywords,
    VisualSearchProductResult,
)

router = APIRouter(prefix="/visual-search", tags=["visual-search"])

SYSTEM_PROMPT = (
    "You are a product identification AI for an e-commerce platform. "
    "Analyze the image and extract relevant search keywords to find matching products. "
    "Return keywords in both French and English."
)
USER_PROMPT = (
    "Analyze this product image and extract 5-8 e-commerce search keywords "
    "that would help find this product or similar products in a marketplace. "
    "Include product type, color, material, style, and category."
)
EXTRACT_KEYWORDS_TOOL = {
    "type": "function",
    "function": {
        "name": "extract_keywords",
        "description": "Extract structured search keywords from the product image analysis.",
        "parameters": {
            "type": "object",
            "properties": {
                "keywords_fr": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "5-8 search keywords in French",
                },
                "keywords_en": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "5-8 search keywords in English",
                },
                "product_type": {
                    "type": "string",
                    "description": "Main product type/category in French",
                },
                "color": {
                    "type": "string",
                    "description": "Primary color in French",
                },
            },
            "required": ["keywords_fr", "keywords_en", "product_type"],
            "additionalProperties": False,
        },
    },
}


@router.post("", response_model=VisualSearchResponse)
async def visual_search(
    body: VisualSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Recherche par image : OpenAI GPT-4o Vision → extraction mots-clés → recherche produits.
    """
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY not configured",
        )

    image_url = body.image_base64
    if not image_url.startswith("data:"):
        image_url = f"data:image/jpeg;base64,{image_url}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        openai_response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": USER_PROMPT},
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ],
                    },
                ],
                "tools": [EXTRACT_KEYWORDS_TOOL],
                "tool_choice": {
                    "type": "function",
                    "function": {"name": "extract_keywords"},
                },
                "max_tokens": 500,
            },
        )

    if openai_response.status_code != 200:
        raise HTTPException(status_code=502, detail="AI analysis failed")

    ai_data = openai_response.json()
    choices = ai_data.get("choices", [{}])
    message = choices[0].get("message", {}) if choices else {}
    tool_calls = message.get("tool_calls", [])
    tool_call = tool_calls[0] if tool_calls else None

    if not tool_call:
        return VisualSearchResponse(
            keywords=ExtractedKeywords(keywords_fr=[], keywords_en=[], product_type="unknown"),
            products=[],
        )

    try:
        extracted = json.loads(tool_call["function"]["arguments"])
    except (json.JSONDecodeError, KeyError):
        return VisualSearchResponse(
            keywords=ExtractedKeywords(keywords_fr=[], keywords_en=[], product_type="unknown"),
            products=[],
        )

    keywords = ExtractedKeywords(
        keywords_fr=extracted.get("keywords_fr", []),
        keywords_en=extracted.get("keywords_en", []),
        product_type=extracted.get("product_type", "unknown"),
        color=extracted.get("color"),
    )

    all_keywords = [
        *keywords.keywords_fr,
        *keywords.keywords_en,
        keywords.product_type,
    ]
    if keywords.color:
        all_keywords.append(keywords.color)
    all_keywords = [kw for kw in all_keywords if kw]

    conditions = []
    for kw in all_keywords:
        pattern = f"%{kw}%"
        conditions.extend([
            Product.name.ilike(pattern),
            Product.name_fr.ilike(pattern),
            Product.description.ilike(pattern),
        ])

    stmt = select(Product).where(Product.publish_status != "archived")
    if conditions:
        stmt = stmt.where(or_(*conditions))
    stmt = stmt.limit(20)
    result = await db.execute(stmt)
    products = result.scalars().unique().all()

    product_ids = [p.id for p in products]
    product_images: dict[UUID, str] = {}
    if product_ids:
        img_stmt = (
            select(ProductImage)
            .where(ProductImage.product_id.in_(product_ids))
            .order_by(ProductImage.position.asc())
        )
        img_result = await db.execute(img_stmt)
        for img in img_result.scalars().all():
            if img.product_id not in product_images:
                product_images[img.product_id] = img.image_url or ""

    def _decimal_to_float(d: Decimal | None) -> float:
        return float(d) if d is not None else 0.0

    results = [
        VisualSearchProductResult(
            id=p.id,
            name=p.name,
            name_fr=p.name_fr,
            price=_decimal_to_float(p.price),
            currency=p.currency or "USD",
            description=p.description,
            rating=_decimal_to_float(p.rating) if p.rating is not None else None,
            review_count=p.review_count,
            store_id=p.store_id,
            image=product_images.get(p.id, "/placeholder.svg"),
        )
        for p in products
    ]

    return VisualSearchResponse(keywords=keywords, products=results)
