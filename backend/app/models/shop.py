"""Boutiques vendeurs."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.utils.date_utils import utc_now


class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    # Compteurs (mis à jour par triggers ou app)
    products_count: Mapped[int] = mapped_column(default=0)
    followers_count: Mapped[int] = mapped_column(default=0)
    sales_count: Mapped[int] = mapped_column(default=0)
    rating: Mapped[float | None] = mapped_column(nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
