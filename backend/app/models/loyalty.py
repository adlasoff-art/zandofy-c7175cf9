"""Fidélité & parrainage — zando_points, point_transactions, referrals, etc. (spec Zandofy)."""
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.utils.date_utils import utc_now


class ZandoPoints(Base):
    __tablename__ = "zando_points"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), unique=True, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    pending_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total_earned: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class PointTransaction(Base):
    __tablename__ = "point_transactions"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    order_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    referral_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    referrer_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    referee_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    commission_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=5, nullable=False)
    max_rewarded_orders: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    rewarded_orders_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class GiftCard(Base):
    __tablename__ = "gift_cards"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    original_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    remaining_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    points_used: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AffiliateTier(Base):
    __tablename__ = "affiliate_tiers"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tier_name: Mapped[str] = mapped_column(String(100), nullable=False)
    min_referrals: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    commission_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    bonus_points: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    badge_label: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class CustomerTier(Base):
    __tablename__ = "customer_tiers"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tier_name: Mapped[str] = mapped_column(String(100), nullable=False)
    badge_label: Mapped[str] = mapped_column(String(255), nullable=False)
    min_orders: Mapped[int] = mapped_column(Integer, nullable=False)
    min_spent: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
