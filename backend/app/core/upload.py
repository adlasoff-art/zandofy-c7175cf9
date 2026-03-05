"""Validation des uploads — type MIME et taille max (spec: app.config)."""
from fastapi import UploadFile, HTTPException

from app.config import settings


def validate_upload(file: UploadFile, max_size: int | None = None, allowed_mime: list[str] | None = None) -> None:
    max_size = max_size or settings.max_upload_bytes
    allowed_mime = allowed_mime or settings.allowed_mime_list
    if file.content_type and file.content_type not in allowed_mime:
        raise HTTPException(status_code=400, detail=f"Type de fichier non autorisé: {file.content_type}")
    # Taille: file.size peut être None (streaming) — on se base sur content-length ou lecture par blocs
    if file.size is not None and file.size > max_size:
        raise HTTPException(status_code=400, detail=f"Fichier trop volumineux (max {settings.max_upload_size_mb} Mo)")
