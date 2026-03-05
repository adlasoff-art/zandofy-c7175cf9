"""Sauvegarde des pièces jointes — chat support (local ou S3 en prod)."""
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.storage import UPLOAD_DIR

CHAT_MEDIA_DIR = UPLOAD_DIR / "chat-media"
CHAT_MEDIA_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 Mo


async def save_chat_attachment(file: UploadFile, ticket_id: uuid.UUID) -> str:
    """
    Sauvegarde un fichier uploadé pour le chat support et retourne l'URL relative.
    En production, remplacer par un upload vers S3/MinIO/Supabase Storage.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Extension {ext} non autorisée")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValueError("Fichier trop volumineux (max 10 Mo)")

    filename = f"{ticket_id}/{uuid.uuid4()}{ext}"
    filepath = CHAT_MEDIA_DIR / filename
    filepath.parent.mkdir(parents=True, exist_ok=True)

    with open(filepath, "wb") as f:
        f.write(content)

    return f"/uploads/chat-media/{filename}"
