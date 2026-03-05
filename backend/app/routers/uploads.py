"""Uploads — images produits, logo boutique (spec: Profile, Store; stockage local ou URL)."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.database import get_db
from app.middleware.auth import RequireVendor
from app.models.profile import Profile
from app.models.store import Store
from app.core.upload import validate_upload
from app.core.storage import UPLOAD_DIR
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/uploads", tags=["uploads"])

CHUNK_SIZE = 65536


def _save_local(file: UploadFile, subdir: str) -> str:
    """Sauvegarde en local et retourne une URL relative. Vérifie la taille en lecture (file.size peut être None)."""
    ext = Path(file.filename or "bin").suffix or ".bin"
    if not ext or ext == ".bin":
        ext = ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / subdir
    dest.mkdir(parents=True, exist_ok=True)
    path = dest / name
    total = 0
    with open(path, "wb") as f:
        while True:
            chunk = file.file.read(CHUNK_SIZE)
            if not chunk:
                break
            total += len(chunk)
            if total > settings.max_upload_bytes:
                path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"Fichier trop volumineux (max {settings.max_upload_size_mb} Mo)",
                )
            f.write(chunk)
    return f"/uploads/{subdir}/{name}"


class UploadOut(BaseModel):
    url: str
    filename: str


@router.post("/product-image", response_model=UploadOut)
async def upload_product_image(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(RequireVendor),
):
    """Upload une image produit (vendeur). Retourne l'URL (relative ou absolue)."""
    validate_upload(file, allowed_mime=["image/jpeg", "image/png", "image/webp"])
    url = _save_local(file, "products")
    return UploadOut(url=url, filename=file.filename or "image")


@router.post("/store-logo", response_model=UploadOut)
async def upload_store_logo(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(RequireVendor),
):
    """Upload le logo de la boutique."""
    validate_upload(file, allowed_mime=["image/jpeg", "image/png", "image/webp"])
    store_result = await db.execute(select(Store).where(Store.owner_id == current_user.id))
    if not store_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Store not found")
    url = _save_local(file, "stores")
    return UploadOut(url=url, filename=file.filename or "logo")
