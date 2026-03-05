"""Produits — products, product_images, product_colors, product_sizes, product_pricing_tiers (spec Zandofy)."""
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.date_utils import utc_now


class Product(Base):
    __tablename__ = "products"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    store_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="SET NULL"), nullable=True)
    category_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    name_fr: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    short_description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    original_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    is_sale: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    moq: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    material: Mapped[str | None] = mapped_column(String(255), nullable=True)
    style: Mapped[str | None] = mapped_column(String(255), nullable=True)
    origin_country: Mapped[str | None] = mapped_column(String(10), nullable=True)
    stock_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_grams: Mapped[int | None] = mapped_column(Integer, nullable=True)
    length_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    width_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    review_count_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sales_count_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verified_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verified_years_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    publish_status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    promo_start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    promo_end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    flash_timer_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flash_timer_duration_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    meta_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    seo_keywords: Mapped[list | None] = mapped_column(ARRAY(Text), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    images: Mapped[list["ProductImage"]] = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    colors: Mapped[list["ProductColor"]] = relationship("ProductColor", back_populates="product", cascade="all, delete-orphan")
    sizes: Mapped[list["ProductSize"]] = relationship("ProductSize", back_populates="product", cascade="all, delete-orphan")
    pricing_tiers: Mapped[list["ProductPricingTier"]] = relationship("ProductPricingTier", back_populates="product", cascade="all, delete-orphan")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)

    product: Mapped["Product"] = relationship("Product", back_populates="images")


class ProductColor(Base):
    __tablename__ = "product_colors"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    color_hex: Mapped[str] = mapped_column(String(20), nullable=False)
    color_name: Mapped[str] = mapped_column(String(100), nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    product: Mapped["Product"] = relationship("Product", back_populates="colors")


class ProductSize(Base):
    __tablename__ = "product_sizes"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    size_label: Mapped[str] = mapped_column(String(50), nullable=False)
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bust_cm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    waist_cm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    hips_cm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)

    product: Mapped["Product"] = relationship("Product", back_populates="sizes")


class ProductPricingTier(Base):
    __tablename__ = "product_pricing_tiers"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    tier_label: Mapped[str] = mapped_column(String(100), nullable=False)
    min_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_type: Mapped[str] = mapped_column(String(20), default="percentage", nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    product: Mapped["Product"] = relationship("Product", back_populates="pricing_tiers")
