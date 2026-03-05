"""Configuration centralisée — variables d'environnement."""
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
    api_prefix: str = "/api/v1"
    # CORS : en prod, définir ex. CORS_ORIGINS=https://zandofy.com,https://www.zandofy.com
    cors_origins: str = ""

    # Database
    database_url: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60

    # SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@zandofy.com"
    smtp_tls: bool = True

    # Kelpay
    kelpay_merchant_code: str = ""
    kelpay_token: str = ""
    kelpay_webhook_secret: str = ""
    kelpay_base_url: str = "https://api.kelpay.com"

    # Storage
    storage_bucket: str = "invoices"
    supabase_storage_url: str = ""

    # VAPID (push)
    vapid_public_key: str = ""
    vapid_private_key: str = ""

    # Rate limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 60

    # Upload
    max_upload_size_mb: int = 10
    allowed_upload_mime: str = "image/jpeg,image/png,image/webp,application/pdf"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.cors_origins.strip():
            return [x.strip() for x in self.cors_origins.split(",") if x.strip()]
        return []

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
