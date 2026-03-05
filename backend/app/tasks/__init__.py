"""Tâches Celery — import des tasks pour enregistrement."""
from app.tasks.email_tasks import send_email_task

__all__ = ["send_email_task"]
