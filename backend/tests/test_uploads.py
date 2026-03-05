"""Tests d'intégration des uploads (auth requise, rejet sans token)."""
import io

import pytest


def test_upload_product_image_without_auth_returns_401(client, api_prefix):
    """POST /uploads/product-image sans token doit retourner 401."""
    resp = client.post(
        f"{api_prefix}/uploads/product-image",
        files={"file": ("test.jpg", io.BytesIO(b"fake image content"), "image/jpeg")},
    )
    assert resp.status_code == 401


def test_upload_store_logo_without_auth_returns_401(client, api_prefix):
    """POST /uploads/store-logo sans token doit retourner 401."""
    resp = client.post(
        f"{api_prefix}/uploads/store-logo",
        files={"file": ("logo.png", io.BytesIO(b"fake png"), "image/png")},
    )
    assert resp.status_code == 401
