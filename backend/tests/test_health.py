"""Tests du health check et de la disponibilité de l'API."""
import pytest


def test_health_returns_ok(client):
    """GET /health doit retourner status ok."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"
    assert "service" in data
