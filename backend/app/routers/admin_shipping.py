"""Admin Shipping — zones, cities, routes, defaults (spec)."""
from decimal import Decimal
from uuid import UUID
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import RequireAdmin
from app.models.profile import Profile
from app.models.shipping import LogisticZone, ShippingZone, City, ShippingRoute, ShippingDefault

router = APIRouter(prefix="/admin/shipping", tags=["admin-shipping"])


# --- Logistic zones ---
class LogisticZoneIn(BaseModel):
    name: str
    continent: str


@router.get("/logistic-zones")
async def list_logistic_zones(db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(LogisticZone).order_by(LogisticZone.name))
    return [{"id": str(z.id), "name": z.name, "continent": z.continent} for z in result.scalars().all()]


@router.post("/logistic-zones")
async def create_logistic_zone(data: LogisticZoneIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    z = LogisticZone(**data.model_dump())
    db.add(z)
    await db.flush()
    return {"id": str(z.id)}


# --- Shipping zones ---
class ShippingZoneIn(BaseModel):
    name: str


@router.get("/zones")
async def list_shipping_zones(db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(ShippingZone).order_by(ShippingZone.name))
    return [{"id": str(z.id), "name": z.name} for z in result.scalars().all()]


@router.post("/zones")
async def create_shipping_zone(data: ShippingZoneIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    z = ShippingZone(**data.model_dump())
    db.add(z)
    await db.flush()
    return {"id": str(z.id)}


# --- Cities ---
class CityIn(BaseModel):
    name: str
    country_code: str
    latitude: float
    longitude: float
    population: int | None = None
    zone_id: UUID | None = None
    logistic_zone_id: UUID | None = None


@router.get("/cities")
async def list_cities(
    db: AsyncSession = Depends(get_db),
    _: Profile = Depends(RequireAdmin),
    country_code: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    q = select(City).order_by(City.name).offset(offset).limit(limit)
    if country_code:
        q = q.where(City.country_code == country_code)
    result = await db.execute(q)
    return [{"id": str(c.id), "name": c.name, "country_code": c.country_code, "zone_id": str(c.zone_id) if c.zone_id else None} for c in result.scalars().all()]


@router.post("/cities")
async def create_city(data: CityIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    c = City(
        name=data.name,
        country_code=data.country_code,
        latitude=Decimal(str(data.latitude)),
        longitude=Decimal(str(data.longitude)),
        population=data.population,
        zone_id=data.zone_id,
        logistic_zone_id=data.logistic_zone_id,
    )
    db.add(c)
    await db.flush()
    return {"id": str(c.id)}


# --- Shipping routes ---
class ShippingRouteIn(BaseModel):
    origin_zone_id: UUID | None = None
    destination_zone_id: UUID | None = None
    transport_mode: str = "road"
    rate_price: float = 0
    rate_unit: str = "kg"
    min_charge: float = 0
    fuel_surcharge_pct: float = 0
    transit_days_min: int | None = None
    transit_days_max: int | None = None
    is_active: bool = True
    notes: str | None = None


@router.get("/routes")
async def list_routes(db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(ShippingRoute).where(ShippingRoute.is_active == True))
    return [
        {"id": str(r.id), "origin_zone_id": str(r.origin_zone_id) if r.origin_zone_id else None, "destination_zone_id": str(r.destination_zone_id) if r.destination_zone_id else None, "rate_price": str(r.rate_price), "transport_mode": r.transport_mode}
        for r in result.scalars().all()
    ]


@router.post("/routes")
async def create_route(data: ShippingRouteIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    r = ShippingRoute(
        origin_zone_id=data.origin_zone_id,
        destination_zone_id=data.destination_zone_id,
        transport_mode=data.transport_mode,
        rate_price=Decimal(str(data.rate_price)),
        rate_unit=data.rate_unit,
        min_charge=Decimal(str(data.min_charge)),
        fuel_surcharge_pct=Decimal(str(data.fuel_surcharge_pct)),
        transit_days_min=data.transit_days_min,
        transit_days_max=data.transit_days_max,
        is_active=data.is_active,
        notes=data.notes,
    )
    db.add(r)
    await db.flush()
    return {"id": str(r.id)}


# --- Shipping defaults ---
class ShippingDefaultIn(BaseModel):
    mode: str
    default_rate: float = 0
    rate_unit: str = "kg"
    currency: str = "USD"


@router.get("/defaults")
async def list_defaults(db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    result = await db.execute(select(ShippingDefault))
    return [{"id": str(d.id), "mode": d.mode, "default_rate": str(d.default_rate), "currency": d.currency} for d in result.scalars().all()]


@router.post("/defaults")
async def create_default(data: ShippingDefaultIn, db: AsyncSession = Depends(get_db), _: Profile = Depends(RequireAdmin)):
    existing = await db.execute(select(ShippingDefault).where(ShippingDefault.mode == data.mode))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Mode already exists")
    d = ShippingDefault(mode=data.mode, rate_unit=data.rate_unit, currency=data.currency, default_rate=Decimal(str(data.default_rate)))
    db.add(d)
    await db.flush()
    return {"id": str(d.id)}
