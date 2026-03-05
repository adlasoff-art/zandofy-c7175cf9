"""Fixtures partagées pour les tests (client HTTP, préfixe API)."""
import os

import pytest
from fastapi.testclient import TestClient

# Désactiver le check JWT production pour les tests (évite RuntimeError au chargement)
os.environ.setdefault("APP_ENV", "development")

from app.main import app
from app.config import settings


@pytest.fixture
def client() -> TestClient:
    """Client HTTP de test (synchronisé) pour l'app FastAPI."""
    return TestClient(app)


@pytest.fixture
def api_prefix() -> str:
    """Préfixe des routes API (ex: /api ou /api/v1)."""
    return settings.api_prefix
