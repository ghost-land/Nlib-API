import pytest
import warnings
from fastapi.testclient import TestClient
from main import app

warnings.filterwarnings("ignore", category=DeprecationWarning, message="The 'app' shortcut is now deprecated")
client = TestClient(app)

GAME_ID = "0100A0D004FB0000"

def test_uptime():
    response = client.get("/uptime")
    assert response.status_code == 200

def test_get_nx_without_asset_type():
    response = client.get(f"/nx/{GAME_ID}")
    assert response.status_code == 200
    assert response.json().get("console") == "nx"

def test_get_nx_icon():
    response = client.get(f"/nx/{GAME_ID}/icon")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
    else:
        assert response.status_code == 404

def test_rate_limiting():
    # Exceed the rate limit to test if 429 is returned
    for _ in range(10):  # Sending more requests than the rate limit allows
        response = client.get("/uptime")
    assert response.status_code == 429
    assert response.json().get("detail") == "Too many requests, please try again later."
