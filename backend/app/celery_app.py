"""Application Celery — broker Redis, tâches async (emails, rapports, etc.)."""
from celery import Celery

from app.config import settings

broker = getattr(settings, "redis_url", "redis://localhost:6379/0")
app = Celery(
    "zandofy",
    broker=broker,
    backend=broker,
    include=["app.tasks"],
)
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
