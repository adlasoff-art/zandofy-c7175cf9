"""Tests support client — tickets et messages."""
import pytest
from uuid import uuid4

from app.config import settings
from app.services.security import create_access_token, get_password_hash
from app.database import get_sync_url
from app.models.profile import Profile, UserRole, AppRole
from app.models.support import SupportTicket, SupportMessage


def _create_support_user_sync():
    """Crée un utilisateur de test et un ticket en base (sync). Retourne token + ticket_id."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    sync_url = get_sync_url()
    engine = create_engine(sync_url)
    Session = sessionmaker(engine, expire_on_commit=False)
    u = uuid4().hex[:8]
    with Session() as db:
        user = Profile(
            id=uuid4(),
            email=f"support_user_{u}@test.zandofy.local",
            password_hash=get_password_hash("Pass123!"),
            first_name="Support",
            last_name="User",
        )
        db.add(user)
        db.flush()
        ticket = SupportTicket(
            id=uuid4(),
            user_id=user.id,
            subject="Test ticket",
            status="open",
            category="other",
            priority="medium",
        )
        db.add(ticket)
        db.flush()
        db.commit()
        token = create_access_token(user.id)
        return {"user_id": user.id, "token": token, "ticket_id": ticket.id}


@pytest.fixture
def support_user_and_ticket(client, api_prefix):
    """Utilisateur + ticket existant. Nécessite DB."""
    return _create_support_user_sync()


def test_create_ticket_requires_auth(client, api_prefix):
    """Sans token, création ticket → 401."""
    resp = client.post(
        f"{api_prefix}/support/tickets",
        json={"subject": "Test", "category": "other"},
    )
    assert resp.status_code == 401


def test_list_tickets_requires_auth(client, api_prefix):
    """Sans token, liste tickets → 401."""
    resp = client.get(f"{api_prefix}/support/tickets")
    assert resp.status_code == 401


@pytest.mark.integration
def test_create_ticket_success(client, api_prefix, support_user_and_ticket):
    """Avec token, création ticket → 201."""
    data = support_user_and_ticket
    resp = client.post(
        f"{api_prefix}/support/tickets",
        json={
            "subject": "Problème livraison",
            "category": "delivery",
            "initial_message": "Ma commande n'est pas arrivée.",
        },
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["subject"] == "Problème livraison"
    assert body["status"] == "open"
    assert body["category"] == "delivery"


@pytest.mark.integration
def test_list_tickets_user_sees_own(client, api_prefix, support_user_and_ticket):
    """Un user voit au moins ses tickets."""
    data = support_user_and_ticket
    resp = client.get(
        f"{api_prefix}/support/tickets",
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "tickets" in body
    assert "total" in body
    assert body["page"] == 1


@pytest.mark.integration
def test_send_message_success(client, api_prefix, support_user_and_ticket):
    """Envoyer un message dans un ticket."""
    data = support_user_and_ticket
    resp = client.post(
        f"{api_prefix}/support/tickets/{data['ticket_id']}/messages",
        data={"content": "Merci pour votre aide."},
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["content"] == "Merci pour votre aide."
    assert body["is_staff"] is False


@pytest.mark.integration
def test_list_messages_success(client, api_prefix, support_user_and_ticket):
    """Liste des messages d'un ticket."""
    data = support_user_and_ticket
    resp = client.get(
        f"{api_prefix}/support/tickets/{data['ticket_id']}/messages",
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "messages" in body
    assert "total" in body
