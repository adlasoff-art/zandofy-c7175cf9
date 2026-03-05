"""Tests d'intégration du webhook KelPay (signature, rejet)."""
import pytest


def test_webhook_kelpay_missing_ref_returns_400(client, api_prefix):
    """POST /webhooks/kelpay sans payment_id/reference valide → 400."""
    resp = client.post(
        f"{api_prefix}/webhooks/kelpay",
        json={"status": "pending"},
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 400
    detail = (resp.json().get("detail") or "").lower()
    assert "reference" in detail or "missing" in detail


@pytest.mark.skip(reason="Requires DB connection; use integration env to run")
def test_webhook_kelpay_unknown_transaction_returns_404(client, api_prefix):
    """POST /webhooks/kelpay avec ref inconnue → 404 (nécessite DB)."""
    resp = client.post(
        f"{api_prefix}/webhooks/kelpay",
        json={"payment_id": "nonexistent-ref-123", "status": "completed"},
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 404
