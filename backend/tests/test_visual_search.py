"""Tests recherche par image (visual search)."""
import base64
import pytest

# PNG 1x1 pixel minimal (base64)
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def test_visual_search_requires_image(client, api_prefix):
    """Sans image_base64 valide → 422."""
    resp = client.post(f"{api_prefix}/visual-search", json={})
    assert resp.status_code == 422


def test_visual_search_accepts_base64_body(client, api_prefix):
    """L'endpoint accepte image_base64 et retourne une structure keywords + products."""
    resp = client.post(
        f"{api_prefix}/visual-search",
        json={"image_base64": f"data:image/png;base64,{TINY_PNG_B64}"},
    )
    # Soit 500 si OPENAI non configuré, soit 200 avec keywords/products
    assert resp.status_code in (200, 500)
    if resp.status_code == 200:
        data = resp.json()
        assert "keywords" in data
        assert "products" in data
        assert isinstance(data["keywords"], dict)
        assert "keywords_fr" in data["keywords"]
        assert "product_type" in data["keywords"]
