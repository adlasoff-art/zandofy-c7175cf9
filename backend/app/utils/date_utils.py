"""Dates timezone-aware (remplace datetime.utcnow déprécié en Python 3.12+)."""
from datetime import datetime, timezone


def utc_now() -> datetime:
    """Retourne l'instant courant en UTC (pour default/onupdate des colonnes)."""
    return datetime.now(timezone.utc)
