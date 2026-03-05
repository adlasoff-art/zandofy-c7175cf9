"""Shipping & logistique (spec Zandofy)."""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.date_utils import utc_now


class LogisticZone(Base):
    __tablename__ = "logistic_zones"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    continent: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ShippingZone(Base):
    __tablename__ = "shipping_zones"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class City(Base):
    __tablename__ = "cities"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country_code: Mapped[str] = mapped_column(String(10), nullable=False)
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    zone_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("shipping_zones.id", ondelete="SET NULL"), nullable=True)
    logistic_zone_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("logistic_zones.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ShippingRoute(Base):
    __tablename__ = "shipping_routes"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    origin_zone_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("shipping_zones.id", ondelete="SET NULL"), nullable=True)
    destination_zone_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("shipping_zones.id", ondelete="SET NULL"), nullable=True)
    transport_mode: Mapped[str] = mapped_column(String(50), default="road", nullable=False)
    rate_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    rate_unit: Mapped[str] = mapped_column(String(20), default="kg", nullable=False)
    min_charge: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    fuel_surcharge_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    transit_days_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transit_days_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class ShippingDefault(Base):
    __tablename__ = "shipping_defaults"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    mode: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    default_rate: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    rate_unit: Mapped[str] = mapped_column(String(20), default="kg", nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    shipper_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    awb_bl: Mapped[str] = mapped_column(String(255), nullable=False)
    origin: Mapped[str] = mapped_column(String(255), nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)
    mode: Mapped[str] = mapped_column(String(50), default="air", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    eta: Mapped[str | None] = mapped_column(String(100), nullable=True)
    items_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class Delivery(Base):
    __tablename__ = "deliveries"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    rider_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    order_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    order_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="assigned", nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    items_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    proof_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    signature_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 6), nullable=True)
    delivery_lng: Mapped[Decimal | None] = mapped_column(Numeric(10, 6), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class RiderLocation(Base):
    __tablename__ = "rider_locations"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    rider_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    delivery_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("deliveries.id", ondelete="SET NULL"), nullable=True)
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 6), default=0, nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(10, 6), default=0, nullable=False)
    heading: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    speed: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class SavedAddress(Base):
    __tablename__ = "saved_addresses"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(50), default="home", nullable=False)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(10), default="CD", nullable=False)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
