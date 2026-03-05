"""Tests admin : set_password (admin only), impersonate (admin/manager), settings impersonation.
Exigent une base PostgreSQL (même URL que le backend). Données créées en sync pour éviter conflit de boucle.
Sur certains environnements (ex. Windows + TestClient), la 2e requête peut échouer (event loop closed) :
auquel cas exécuter les tests d'admin avec un serveur réel (uvicorn + httpx) ou en CI avec pool asyncio dédié.
"""
import pytest
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_sync_url
from app.models.profile import Profile, UserRole, AppRole
from app.services.security import (
    get_password_hash,
    create_access_token,
    create_impersonation_access_token,
    decode_access_token,
    decode_token,
    TYPE_IMPERSONATION_ACCESS,
)


def _create_admin_manager_targets_sync():
    """Crée en base (connexion sync) un admin, un manager, un vendor et un admin cible. Emails uniques par run."""
    sync_url = get_sync_url()
    sync_engine = create_engine(sync_url)
    SyncSession = sessionmaker(sync_engine, expire_on_commit=False)
    u = uuid4().hex[:8]
    with SyncSession() as db:
        admin = Profile(
            id=uuid4(),
            email=f"test_admin_{u}@test.zandofy.local",
            password_hash=get_password_hash("AdminPass123!"),
            first_name="Admin",
            last_name="Test",
        )
        manager = Profile(
            id=uuid4(),
            email=f"test_manager_{u}@test.zandofy.local",
            password_hash=get_password_hash("ManagerPass123!"),
            first_name="Manager",
            last_name="Test",
        )
        target_vendor = Profile(
            id=uuid4(),
            email=f"test_target_vendor_{u}@test.zandofy.local",
            password_hash=get_password_hash("Target123!"),
            first_name="Target",
            last_name="Vendor",
        )
        target_admin = Profile(
            id=uuid4(),
            email=f"test_target_admin_{u}@test.zandofy.local",
            password_hash=get_password_hash("Target123!"),
            first_name="Target",
            last_name="Admin",
        )
        db.add(admin)
        db.add(manager)
        db.add(target_vendor)
        db.add(target_admin)
        db.flush()
        db.add(UserRole(user_id=admin.id, role=AppRole.admin))
        db.add(UserRole(user_id=manager.id, role=AppRole.manager))
        db.add(UserRole(user_id=target_vendor.id, role=AppRole.vendor))
        db.add(UserRole(user_id=target_admin.id, role=AppRole.admin))
        db.commit()
        admin_token = create_access_token(admin.id)
        manager_token = create_access_token(manager.id)
        return {
            "admin_id": admin.id,
            "manager_id": manager.id,
            "target_vendor_id": target_vendor.id,
            "target_admin_id": target_admin.id,
            "admin_token": admin_token,
            "manager_token": manager_token,
        }


@pytest.fixture
def admin_manager_target_ids(client, api_prefix):
    """Crée en base (sync) un admin, un manager, un vendor. Nécessite DB."""
    return _create_admin_manager_targets_sync()


def test_impersonation_jwt_has_claim():
    """Le JWT d'impersonation contient type, sub, impersonated_by ; decode_access_token l'accepte (sans HTTP)."""
    admin_id = uuid4()
    target_id = uuid4()
    token = create_impersonation_access_token(
        subject=target_id,
        email="u@example.com",
        roles=["vendor"],
        impersonated_by=admin_id,
    )
    payload = decode_token(token)
    assert payload.get("type") == TYPE_IMPERSONATION_ACCESS
    assert payload.get("sub") == str(target_id)
    assert payload.get("impersonated_by") == str(admin_id)
    assert payload.get("email") == "u@example.com"
    assert payload.get("roles") == ["vendor"]
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded.get("impersonated_by") == str(admin_id)


@pytest.mark.integration
def test_admin_set_password_impersonation_and_claims(client, api_prefix, admin_manager_target_ids):
    """Intégration : admin set_password, manager interdit set_password, impersonate, settings, JWT claim.
    Peut échouer après la 1re requête sur certains env (event loop) ; exécuter avec -m integration si DB dispo.
    """
    ids = admin_manager_target_ids
    prefix = api_prefix

    # 1) Admin peut modifier le mot de passe
    resp = client.put(
        f"{prefix}/admin/users/{ids['target_vendor_id']}/password",
        json={"new_password": "NewSecure123!"},
        headers={"Authorization": f"Bearer {ids['admin_token']}"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"success": True}

    # 2) Manager ne peut PAS modifier les mots de passe
    resp = client.put(
        f"{prefix}/admin/users/{ids['target_vendor_id']}/password",
        json={"new_password": "Other123!"},
        headers={"Authorization": f"Bearer {ids['manager_token']}"},
    )
    assert resp.status_code == 403

    # 3) Admin peut impersonner n'importe qui
    resp = client.post(
        f"{prefix}/admin/users/{ids['target_vendor_id']}/impersonate",
        headers={"Authorization": f"Bearer {ids['admin_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["id"] == str(ids["target_vendor_id"])
    assert data["impersonated_by"] == str(ids["admin_id"])

    # 4) JWT contient le claim impersonated_by
    access_token = data["access_token"]
    payload = decode_token(access_token)
    assert payload.get("type") == TYPE_IMPERSONATION_ACCESS
    assert payload.get("impersonated_by") == str(ids["admin_id"])
    assert payload.get("sub") == str(ids["target_vendor_id"])
    decoded = decode_access_token(access_token)
    assert decoded is not None
    assert decoded.get("impersonated_by") == str(ids["admin_id"])

    # 5) Manager ne peut PAS impersonner un admin
    resp = client.post(
        f"{prefix}/admin/users/{ids['target_admin_id']}/impersonate",
        headers={"Authorization": f"Bearer {ids['manager_token']}"},
    )
    assert resp.status_code == 403

    # 6) Config impersonation (admin) puis manager peut impersonner vendor
    client.put(
        f"{prefix}/admin/settings/impersonation",
        json={"allowed_roles": ["vendor", "rider", "shipper"]},
        headers={"Authorization": f"Bearer {ids['admin_token']}"},
    )
    resp = client.post(
        f"{prefix}/admin/users/{ids['target_vendor_id']}/impersonate",
        headers={"Authorization": f"Bearer {ids['manager_token']}"},
    )
    assert resp.status_code == 200
