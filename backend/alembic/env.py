from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy import create_engine
from alembic import context
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings
from app.database import Base, get_sync_url
from app.models import *  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
# Ne pas passer l'URL via set_main_option : le % (ex. %40) est interprété par ConfigParser.
# On utilise get_sync_url() directement ci-dessous.

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = get_sync_url()
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = get_sync_url()
    connectable = create_engine(url, poolclass=pool.NullPool)
    try:
        with connectable.connect() as connection:
            do_run_migrations(connection)
    except Exception as e:
        # Afficher le message complet (ex: mot de passe avec @ non encodé, service arrêté, base inexistante)
        err = e.orig if hasattr(e, "orig") else e
        print(f"\nConnexion PostgreSQL impossible: {err}\n")
        raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
