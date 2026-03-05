"""CRON — libération automatique des fonds vendeurs (quotidien)."""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import AsyncSessionLocal
from app.services.wallet_release import release_vendor_pending_funds

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _job_release_funds():
    try:
        async with AsyncSessionLocal() as db:
            await release_vendor_pending_funds(db)
    except Exception as e:
        logger.exception("release_vendor_pending_funds job failed: %s", e)


def start_scheduler():
    # Tous les jours à 02:00
    scheduler.add_job(_job_release_funds, CronTrigger(hour=2, minute=0), id="release_vendor_funds")
    scheduler.start()
    logger.info("Scheduler started (release_vendor_funds daily)")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
