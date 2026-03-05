"""Phase 4 — vendor_wallets, vendor_transactions, withdrawal_requests, coupons, vendor_subscriptions (spec).

Revision ID: 003
Revises: 002
Create Date: 2025-03-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) vendor_wallets (spec: store_id -> stores)
    op.create_table(
        "vendor_wallets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("available_balance", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("pending_balance", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_earned", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_withdrawn", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("retention_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", name="uq_vendor_wallets_store_id"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
    )

    # 2) vendor_transactions
    op.create_table(
        "vendor_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="SET NULL"),
    )

    # 3) withdrawal_requests
    op.create_table(
        "withdrawal_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("method", sa.String(50), nullable=False, server_default="mobile_money"),
        sa.Column("phone_number", sa.String(50), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("processed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["processed_by"], ["profiles.id"], ondelete="SET NULL"),
    )

    # 4) coupons (platform-wide)
    op.create_table(
        "coupons",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("discount_type", sa.String(20), nullable=False, server_default="percentage"),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("min_order_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("current_uses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_coupons_code"),
    )
    op.create_index("ix_coupons_code", "coupons", ["code"], unique=True)

    # 5) vendor_subscriptions (spec) — replace 001 table if present (FK shops)
    op.execute("DROP TABLE IF EXISTS vendor_subscriptions CASCADE")
    op.create_table(
        "vendor_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tier", sa.String(50), nullable=False, server_default="beginner"),
        sa.Column("max_products", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("is_whatsapp_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("can_self_deliver", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("payment_method", sa.String(50), nullable=True),
        sa.Column("paid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", name="uq_vendor_subscriptions_store_id"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("vendor_subscriptions")
    op.drop_index("ix_coupons_code", table_name="coupons")
    op.drop_table("coupons")
    op.drop_table("withdrawal_requests")
    op.drop_table("vendor_transactions")
    op.drop_table("vendor_wallets")
