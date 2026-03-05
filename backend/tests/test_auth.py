"""Tests d'intégration des routes d'authentification (auth spec)."""
import pytest


def test_login_missing_credentials_returns_422(client, api_prefix):
    """POST /auth/login sans body doit retourner 422."""
    resp = client.post(f"{api_prefix}/auth/login", json={})
    assert resp.status_code == 422


def test_login_invalid_credentials_returns_401(client, api_prefix):
    """POST /auth/login avec email/mot de passe invalides doit retourner 401."""
    resp = client.post(
        f"{api_prefix}/auth/login",
        json={"email": "nonexistent@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401
    assert "detail" in resp.json() or "Invalid" in resp.text


def test_register_validation_email_required(client, api_prefix):
    """POST /auth/register sans email doit retourner 422."""
    resp = client.post(
        f"{api_prefix}/auth/register",
        json={"password": "Secret123!", "first_name": "A", "last_name": "B"},
    )
    assert resp.status_code == 422


def test_me_without_token_returns_401(client, api_prefix):
    """GET /auth/me sans token doit retourner 401."""
    resp = client.get(f"{api_prefix}/auth/me")
    assert resp.status_code == 401
