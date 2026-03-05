"""Rate limiting simple (en mémoire) sur les endpoints sensibles."""
import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, HTTPException

# (ip -> list of timestamps)
_store: dict[str, list[float]] = defaultdict(list)
_window = 60  # secondes
_max_requests = 100


def rate_limit_middleware(request: Request) -> None:
    """À utiliser comme dépendance sur les routes sensibles (login, register, webhooks)."""
    from app.config import settings
    window = getattr(settings, "rate_limit_window", 60)
    max_r = getattr(settings, "rate_limit_requests", 100)
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    _store[key] = [t for t in _store[key] if now - t < window]
    if len(_store[key]) >= max_r:
        raise HTTPException(status_code=429, detail="Too many requests")
    _store[key].append(now)


def get_rate_limiter():
    def _limiter(request: Request):
        return rate_limit_middleware(request)
    return _limiter
