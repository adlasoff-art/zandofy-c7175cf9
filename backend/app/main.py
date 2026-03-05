"""Point d'entrée FastAPI — Zandofy Backend."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.core.storage import UPLOAD_DIR
from app.core.scheduler import start_scheduler, stop_scheduler
from app.routers import auth_spec
from app.routers import (
    auth,
    payments,
    orders,
    search,
    email,
    invoices,
    push,
    subscriptions,
    sitemap,
    analytics,
    admin,
    admin_cms,
    admin_shipping,
    cms_public,
    webhooks,
    categories,
    products,
    cart,
    shipping_calc,
    ws,
    vendor_dashboard,
    vendor_wallet,
    coupons,
    zando_points,
    uploads,
    support,
    support_ws,
    visual_search,
)

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Ajoute des en-têtes de sécurité (OWASP, durcissement navigateur)."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # Ne pas appliquer CSP sur la doc Swagger (charge des scripts depuis CDN)
        if request.url.path in ("/docs", "/redoc", "/openapi.json"):
            return response
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # CSP minimal : autorise les mêmes origines et les requêtes API ; durcir en prod si besoin
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
        )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # En production, refuser de démarrer si JWT secret par défaut (évite tokens forgés)
    if settings.app_env == "production" and (
        not settings.jwt_secret_key or settings.jwt_secret_key == "change-me-in-production"
    ):
        raise RuntimeError(
            "JWT_SECRET_KEY doit être défini et différent du défaut en production. "
            "Voir OWASP A02:2021 – Cryptographic Failures."
        )
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Zandofy API",
    description="Backend plateforme Zandofy — Paiement, recherche, emails, factures, push, analytics",
    version="1.0.0",
    lifespan=lifespan,
)

_default_origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
allowed_origins = settings.cors_origins_list or _default_origins

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

app.include_router(auth_spec.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix, tags=["Auth (legacy)"])
app.include_router(orders.router, prefix=settings.api_prefix, tags=["Orders"])
app.include_router(payments.router, prefix=settings.api_prefix, tags=["Payments"])
app.include_router(webhooks.router, prefix=settings.api_prefix, tags=["Webhooks"])
app.include_router(search.router, prefix=settings.api_prefix, tags=["Search"])
app.include_router(email.router, prefix=settings.api_prefix, tags=["Email"])
app.include_router(invoices.router, prefix=settings.api_prefix, tags=["Invoices"])
app.include_router(push.router, prefix=settings.api_prefix, tags=["Push"])
app.include_router(subscriptions.router, prefix=settings.api_prefix, tags=["Subscriptions"])
app.include_router(sitemap.router, prefix=settings.api_prefix, tags=["Sitemap"])
app.include_router(analytics.router, prefix=settings.api_prefix, tags=["Analytics"])
app.include_router(admin.router, prefix=settings.api_prefix, tags=["Admin"])
app.include_router(admin_cms.router, prefix=settings.api_prefix)
app.include_router(admin_shipping.router, prefix=settings.api_prefix)
app.include_router(cms_public.router, prefix=settings.api_prefix)
app.include_router(categories.router, prefix=settings.api_prefix)
app.include_router(products.router, prefix=settings.api_prefix)
app.include_router(cart.router, prefix=settings.api_prefix)
app.include_router(shipping_calc.router, prefix=settings.api_prefix)
app.include_router(ws.router, prefix=settings.api_prefix)
app.include_router(vendor_dashboard.router, prefix=settings.api_prefix)
app.include_router(vendor_wallet.router, prefix=settings.api_prefix)
app.include_router(coupons.router, prefix=settings.api_prefix)
app.include_router(zando_points.router, prefix=settings.api_prefix)
app.include_router(uploads.router, prefix=settings.api_prefix)
app.include_router(support.router, prefix=settings.api_prefix)
app.include_router(support_ws.router, prefix=settings.api_prefix + "/support")
app.include_router(visual_search.router, prefix=settings.api_prefix)

# Fichiers uploadés (images produits, logos, chat-media)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok", "service": "zandofy-backend"}
