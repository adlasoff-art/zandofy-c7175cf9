"""Schémas Pydantic — auth (spec Zandofy)."""
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # seconds (15 min)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class RefreshIn(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class ResetPasswordIn(BaseModel):
    token: str = Field(..., description="Reset token from email link")
    new_password: str = Field(..., min_length=8)


class UserOut(BaseModel):
    id: UUID
    email: str | None
    first_name: str | None
    last_name: str | None
    phone: str | None
    avatar_url: str | None
    customer_tier: str
    is_banned: bool
    email_verified: bool
    roles: list[str] = []

    model_config = {"from_attributes": True}
