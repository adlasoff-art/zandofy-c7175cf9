"""Phase 5 — admin_audit_logs, CMS (banners, sections, menu, pages, popups), shipping (zones, cities, routes)."""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) admin_audit_logs (spec: admin_id, target_user_id = profiles)
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(255), nullable=False),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2) CMS
    op.create_table(
        "cms_banners",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("subtitle", sa.String(500), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("link", sa.Text(), nullable=True),
        sa.Column("cta", sa.String(255), nullable=True),
        sa.Column("position", sa.String(50), nullable=False, server_default="hero"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "cms_homepage_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_key", sa.String(100), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "cms_menu_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("url", sa.String(500), nullable=False, server_default=""),
        sa.Column("menu_group", sa.String(50), nullable=False, server_default="main"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "cms_pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_cms_pages_slug"),
    )
    op.create_index("ix_cms_pages_slug", "cms_pages", ["slug"], unique=True)
    op.create_table(
        "cms_popups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("link", sa.Text(), nullable=True),
        sa.Column("link_label", sa.String(255), nullable=True),
        sa.Column("display_frequency", sa.String(50), nullable=False, server_default="once"),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3) Shipping
    op.create_table(
        "logistic_zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("continent", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "shipping_zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "cities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("country_code", sa.String(10), nullable=False),
        sa.Column("latitude", sa.Numeric(10, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(10, 6), nullable=False),
        sa.Column("population", sa.Integer(), nullable=True),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("logistic_zone_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["zone_id"], ["shipping_zones.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["logistic_zone_id"], ["logistic_zones.id"], ondelete="SET NULL"),
    )
    op.create_table(
        "shipping_routes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("origin_zone_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("destination_zone_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("transport_mode", sa.String(50), nullable=False, server_default="road"),
        sa.Column("rate_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("rate_unit", sa.String(20), nullable=False, server_default="kg"),
        sa.Column("min_charge", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("fuel_surcharge_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("transit_days_min", sa.Integer(), nullable=True),
        sa.Column("transit_days_max", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["origin_zone_id"], ["shipping_zones.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["destination_zone_id"], ["shipping_zones.id"], ondelete="SET NULL"),
    )
    op.create_table(
        "shipping_defaults",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mode", sa.String(50), nullable=False),
        sa.Column("default_rate", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("rate_unit", sa.String(20), nullable=False, server_default="kg"),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mode", name="uq_shipping_defaults_mode"),
    )


def downgrade() -> None:
    op.drop_table("shipping_defaults")
    op.drop_table("shipping_routes")
    op.drop_table("cities")
    op.drop_table("shipping_zones")
    op.drop_table("logistic_zones")
    op.drop_table("cms_popups")
    op.drop_index("ix_cms_pages_slug", table_name="cms_pages")
    op.drop_table("cms_pages")
    op.drop_table("cms_menu_items")
    op.drop_table("cms_homepage_sections")
    op.drop_table("cms_banners")
    op.drop_table("admin_audit_logs")
