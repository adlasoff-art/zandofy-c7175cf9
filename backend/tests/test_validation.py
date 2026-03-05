"""Tests unitaires de validation des schémas (auth, entrées API)."""
import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterIn, LoginIn, RefreshIn, ResetPasswordIn


def test_register_in_valid():
    """RegisterIn accepte email + password (min 8 caractères)."""
    data = RegisterIn(email="user@example.com", password="Secret123!")
    assert data.email == "user@example.com"
    assert data.password == "Secret123!"


def test_register_in_password_too_short_raises():
    """RegisterIn rejette un mot de passe < 8 caractères."""
    with pytest.raises(ValidationError):
        RegisterIn(email="user@example.com", password="short")


def test_register_in_invalid_email_raises():
    """RegisterIn rejette un email invalide."""
    with pytest.raises(ValidationError):
        RegisterIn(email="not-an-email", password="ValidPass123!")


def test_login_in_requires_email_and_password():
    """LoginIn exige email et password."""
    data = LoginIn(email="a@b.co", password="any")
    assert data.email == "a@b.co"
    with pytest.raises(ValidationError):
        LoginIn(email="a@b.co")  # type: ignore


def test_refresh_in_requires_token():
    """RefreshIn exige refresh_token non vide."""
    data = RefreshIn(refresh_token="jwt.here")
    assert data.refresh_token == "jwt.here"
    with pytest.raises(ValidationError):
        RefreshIn(refresh_token="")


def test_reset_password_in_new_password_min_length():
    """ResetPasswordIn exige new_password d'au moins 8 caractères."""
    with pytest.raises(ValidationError):
        ResetPasswordIn(token="t", new_password="short")
