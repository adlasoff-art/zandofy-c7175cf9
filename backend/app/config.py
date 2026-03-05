"""Configuration centralisée — variables d'environnement (spec Zandofy)."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_env: str = "development"
    debug: bool = True
    api_prefix: str = "/api"

    # CORS : whitelist des origins (ex: https://zandofy.com,http://localhost:5173)
    cors_origins: str = ""

    # Database
    database_url: str = ""

    # JWT — access 15 min, refresh 7 jours (spec)
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7

    # SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@zandofy.com"
    smtp_tls: bool = True

    # KelPay (Mobile Money RDC)
    kelpay_merchant_code: str = ""
    kelpay_token: str = ""
    kelpay_webhook_secret: str = ""
    kelpay_base_url: str = "https://pay.keccel.com/kelpay/v1"
    kelpay_check_url: str = "https://pay.keccel.com/kelpay/v1/checktransaction.asp"

    # Redis (cache + Celery broker)
    redis_url: str = "redis://localhost:6379/0"

    # Storage / uploads (optionnel: Supabase ou S3 pour factures / images)
    storage_bucket: str = "invoices"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # Secret JWT Supabase (Project Settings > API > JWT Secret) pour accepter les tokens du frontend
    supabase_jwt_secret: str = ""
    max_upload_size_mb: int = 10
    allowed_upload_mime: str = "image/jpeg,image/png,image/webp,application/pdf"
    # Sitemap
    site_base_url: str = "https://zandofy.com"

    # Push (Web Push)
    vapid_public_key: str = ""
    vapid_private_key: str = ""

    # OpenAI (recherche visuelle GPT-4o)
    openai_api_key: str = ""

    # Rate limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 60

    # Commission plateforme (spec: 10%)
    platform_commission_pct: float = 10.0

    # Wallet vendeur: jours avant release des fonds pending
    vendor_retention_days: int = 30

    @property
    def cors_origins_list(self) -> List[str]:
        if self.cors_origins.strip():
            return [x.strip() for x in self.cors_origins.split(",") if x.strip()]
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    @property
    def allowed_mime_list(self) -> List[str]:
        return [x.strip() for x in self.allowed_upload_mime.split(",") if x.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
