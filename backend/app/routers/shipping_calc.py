"""Calcul livraison — estimation coût (spec Zandofy, Phase 2 minimal)."""
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/shipping", tags=["shipping"])


class ShippingEstimateOut(BaseModel):
    """Estimation simple : base + par kg (à affiner avec zones/routes)."""
    amount: str
    currency: str = "USD"
    estimated_days_min: int = 2
    estimated_days_max: int = 5


# Constantes minimales (à remplacer par LogisticZone / ShippingRoute en Phase 3)
DEFAULT_BASE_SHIPPING = Decimal("5.00")
DEFAULT_PER_KG = Decimal("1.50")


@router.get("/estimate", response_model=ShippingEstimateOut)
async def estimate_shipping(
    city: str | None = Query(None, description="Ville (optionnel, pour future zone)"),
    weight_grams: int = Query(0, ge=0, description="Poids total en grammes"),
    country: str = Query("CD", description="Code pays"),
):
    """Retourne une estimation du coût de livraison (formule simple)."""
    base = DEFAULT_BASE_SHIPPING
    per_kg = DEFAULT_PER_KG
    weight_kg = max(0, weight_grams) / 1000
    amount = base + (per_kg * Decimal(str(weight_kg)))
    return ShippingEstimateOut(
        amount=str(round(amount, 2)),
        currency="USD",
        estimated_days_min=2,
        estimated_days_max=5,
    )
