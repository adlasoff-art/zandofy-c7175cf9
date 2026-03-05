"""Spec Zandofy — profiles, stores, user_roles, categories, products, orders, etc.

Revision ID: 002
Revises: 001
Create Date: 2025-03-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Enum app_role
    app_role = postgresql.ENUM("admin", "manager", "vendor", "shipper", "rider", name="app_role", create_type=True)
    app_role.create(op.get_bind(), checkfirst=True)

    # 2) profiles
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("first_name", sa.String(255), nullable=True),
        sa.Column("last_name", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(50), nullable=True),
        sa.Column("referral_code", sa.String(50), nullable=True),
        sa.Column("affiliate_tier", sa.String(50), nullable=True),
        sa.Column("customer_tier", sa.String(50), nullable=False, server_default="bronze"),
        sa.Column("is_banned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("ban_reason", sa.Text(), nullable=True),
        sa.Column("banned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("banned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_profiles_email", "profiles", ["email"], unique=True)
    op.create_index("ix_profiles_referral_code", "profiles", ["referral_code"], unique=True)

    # 3) stores
    op.create_table(
        "stores",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("country", sa.String(10), nullable=False, server_default="CD"),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("whatsapp_number", sa.String(50), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("verified_years", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("verified_years_override", sa.Integer(), nullable=True),
        sa.Column("is_online", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("products_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("followers_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("followers_override", sa.Integer(), nullable=True),
        sa.Column("sales_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sales_override", sa.Integer(), nullable=True),
        sa.Column("sales_trend", sa.String(50), nullable=False, server_default="stable"),
        sa.Column("repurchase_rate", sa.Numeric(5, 4), nullable=False, server_default="0"),
        sa.Column("rating", sa.Numeric(3, 2), nullable=False, server_default="0"),
        sa.Column("response_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("response_time", sa.String(50), nullable=False, server_default="< 24h"),
        sa.Column("flash_timer_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.ForeignKeyConstraint(["owner_id"], ["profiles.id"], ondelete="CASCADE"),
    )

    # 4) user_roles (FK profiles + stores) — supprimer l'ancienne table user_roles de la migration 001 (structure différente)
    op.execute("DROP TABLE IF EXISTS user_roles CASCADE")
    op.create_table(
        "user_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", postgresql.ENUM("admin", "manager", "vendor", "shipper", "rider", name="app_role", create_type=False), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="SET NULL"),
    )

    # 5) store_followers, store_reviews
    op.create_table(
        "store_followers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", "user_id", name="uq_store_followers_store_user"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "store_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("helpful_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
    )

    # 6) categories — supprimer les tables 001 homonymes (ordre FK: order_items → orders → payment_transactions → products → categories)
    op.execute("DROP TABLE IF EXISTS order_items CASCADE")
    op.execute("DROP TABLE IF EXISTS orders CASCADE")
    op.execute("DROP TABLE IF EXISTS payment_transactions CASCADE")
    op.execute("DROP TABLE IF EXISTS products CASCADE")
    op.execute("DROP TABLE IF EXISTS categories CASCADE")
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("name_fr", sa.String(255), nullable=False),
        sa.Column("icon", sa.String(255), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"], ondelete="SET NULL"),
    )
    op.create_table(
        "category_surcharges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("surcharge_type", sa.String(50), nullable=False, server_default="percentage"),
        sa.Column("surcharge_value", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("label", sa.String(255), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_id"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
    )

    # 7) products + product_*
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("name_fr", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("short_description", sa.String(1000), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("original_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("discount", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("is_sale", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_new", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("moq", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("material", sa.String(255), nullable=True),
        sa.Column("style", sa.String(255), nullable=True),
        sa.Column("origin_country", sa.String(10), nullable=True),
        sa.Column("stock_quantity", sa.Integer(), nullable=True),
        sa.Column("weight_grams", sa.Integer(), nullable=True),
        sa.Column("length_cm", sa.Numeric(8, 2), nullable=True),
        sa.Column("width_cm", sa.Numeric(8, 2), nullable=True),
        sa.Column("height_cm", sa.Numeric(8, 2), nullable=True),
        sa.Column("rating", sa.Numeric(3, 2), nullable=False, server_default="0"),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("review_count_override", sa.Integer(), nullable=True),
        sa.Column("sales_count_override", sa.Integer(), nullable=True),
        sa.Column("verified_years", sa.Integer(), nullable=True),
        sa.Column("verified_years_override", sa.Integer(), nullable=True),
        sa.Column("publish_status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("promo_start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("promo_end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("flash_timer_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("flash_timer_duration_hours", sa.Integer(), nullable=True),
        sa.Column("meta_title", sa.String(255), nullable=True),
        sa.Column("meta_description", sa.Text(), nullable=True),
        sa.Column("seo_keywords", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
    )
    op.create_table(
        "product_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "product_colors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("color_hex", sa.String(20), nullable=False),
        sa.Column("color_name", sa.String(100), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "product_sizes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("size_label", sa.String(50), nullable=False),
        sa.Column("region", sa.String(50), nullable=True),
        sa.Column("bust_cm", sa.Numeric(6, 2), nullable=True),
        sa.Column("waist_cm", sa.Numeric(6, 2), nullable=True),
        sa.Column("hips_cm", sa.Numeric(6, 2), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "product_pricing_tiers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tier_label", sa.String(100), nullable=False),
        sa.Column("min_quantity", sa.Integer(), nullable=False),
        sa.Column("discount_type", sa.String(20), nullable=False, server_default="percentage"),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
    )

    # 8) orders, order_items, order_status_history, cart_items
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("order_ref", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("shipping_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("discount_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("coupon_code", sa.String(100), nullable=True),
        sa.Column("payment_method", sa.String(50), nullable=True),
        sa.Column("delivery_choice", sa.String(50), nullable=True),
        sa.Column("last_mile_fee", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("last_mile_payment_method", sa.String(50), nullable=True),
        sa.Column("tracking_number", sa.String(255), nullable=True),
        sa.Column("confirmation_code", sa.String(100), nullable=True),
        sa.Column("assigned_rider_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_rider_name", sa.String(255), nullable=True),
        sa.Column("shipping_first_name", sa.String(255), nullable=True),
        sa.Column("shipping_last_name", sa.String(255), nullable=True),
        sa.Column("shipping_email", sa.String(255), nullable=True),
        sa.Column("shipping_phone", sa.String(50), nullable=True),
        sa.Column("shipping_address", sa.Text(), nullable=True),
        sa.Column("shipping_city", sa.String(100), nullable=True),
        sa.Column("shipping_country", sa.String(10), nullable=True),
        sa.Column("shipping_postal_code", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_ref"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_rider_id"], ["profiles.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_orders_order_ref", "orders", ["order_ref"], unique=True)
    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("product_name", sa.String(500), nullable=False),
        sa.Column("product_image", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("size", sa.String(50), nullable=True),
        sa.Column("color", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
    )
    op.create_table(
        "order_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("changed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["profiles.id"], ondelete="SET NULL"),
    )
    op.create_table(
        "cart_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("size", sa.String(50), nullable=True),
        sa.Column("color", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
    )

    # 9) payment_transactions
    op.create_table(
        "payment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("method", sa.String(50), nullable=False, server_default="mobile_money"),
        sa.Column("provider", sa.String(50), nullable=True),
        sa.Column("phone_number", sa.String(50), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("reference", sa.String(255), nullable=False),
        sa.Column("transaction_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("callback_payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("reference"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_payment_transactions_reference", "payment_transactions", ["reference"], unique=True)


def downgrade() -> None:
    op.drop_table("payment_transactions")
    op.drop_table("cart_items")
    op.drop_table("order_status_history")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("product_pricing_tiers")
    op.drop_table("product_sizes")
    op.drop_table("product_colors")
    op.drop_table("product_images")
    op.drop_table("products")
    op.drop_table("category_surcharges")
    op.drop_table("categories")
    op.drop_table("store_reviews")
    op.drop_table("store_followers")
    op.drop_table("user_roles")
    op.drop_table("stores")
    op.drop_table("profiles")
    op.execute("DROP TYPE IF EXISTS app_role")
