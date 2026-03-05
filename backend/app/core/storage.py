"""Stockage local — répertoire d'uploads (produits, stores, etc.)."""
from pathlib import Path

# backend/app/core/storage.py -> parent.parent = app, app/uploads
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
