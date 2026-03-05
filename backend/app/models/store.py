"""Boutiques — stores, store_followers, store_reviews (spec Zandofy)."""
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.utils.date_utils import utc_now


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    country: Mapped[str] = mapped_column(String(10), default="CD", nullable=False)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    whatsapp_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_years: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verified_years_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    products_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    followers_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    followers_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sales_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sales_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sales_trend: Mapped[str] = mapped_column(String(50), default="stable", nullable=False)
    repurchase_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=0, nullable=False)
    rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    response_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    response_time: Mapped[str] = mapped_column(String(50), default="< 24h", nullable=False)
    flash_timer_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    followers: Mapped[list["StoreFollower"]] = relationship("StoreFollower", back_populates="store", cascade="all, delete-orphan")
    reviews: Mapped[list["StoreReview"]] = relationship("StoreReview", back_populates="store", cascade="all, delete-orphan")


class StoreFollower(Base):
    __tablename__ = "store_followers"
    __table_args__ = (UniqueConstraint("store_id", "user_id", name="uq_store_followers_store_user"),)

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    store_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    store: Mapped["Store"] = relationship("Store", back_populates="followers")


class StoreReview(Base):
    __tablename__ = "store_reviews"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    store_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    helpful_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    store: Mapped["Store"] = relationship("Store", back_populates="reviews")
