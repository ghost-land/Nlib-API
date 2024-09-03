import pytest
import warnings
from fastapi.testclient import TestClient
from main import app, config
from time import sleep

warnings.filterwarnings("ignore", category=DeprecationWarning, message="The 'app' shortcut is now deprecated")
client = TestClient(app)

GAME_ID = "0100A0D004FB0000"

def test_uptime():
    response = client.get("/uptime")
    assert response.status_code == 200

def test_uptime_head():
    response = client.head("/uptime")
    assert response.status_code == 200

def test_get_nx_without_asset_type():
    response = client.get(f"/nx/{GAME_ID}")
    assert response.status_code == 200
    assert response.json().get("console") == "nx"

def test_get_switch_without_asset_type():
    response = client.get(f"/switch/{GAME_ID}")
    assert response.status_code == 200
    assert response.json().get("console") == "nx"

def test_get_nx_icon():
    response = client.get(f"/nx/{GAME_ID}/icon")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
    else:
        assert response.status_code == 404

def test_get_nx_banner():
    response = client.get(f"/nx/{GAME_ID}/banner")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
    else:
        assert response.status_code == 404

def test_get_nx_screen():
    response = client.get(f"/nx/{GAME_ID}/screen")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
    else:
        assert response.status_code == 404

def test_get_nx_screen_with_id():
    response = client.get(f"/nx/{GAME_ID}/screen/2")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
    else:
        assert response.status_code == 404

def test_get_nx_screens():
    response = client.get(f"/nx/{GAME_ID}/screens")
    assert response.status_code == 200
    assert "count" in response.json()
    assert "screenshots" in response.json()

def test_get_nx_full():
    response = client.get("/nx/full")
    assert response.status_code == 200
    assert "titledb" in response.json()
    assert isinstance(response.json()['titledb']['0100000000010000'], dict)

def test_get_nx_all():
    response = client.get("/nx/all")
    assert response.status_code == 200

def test_get_nx_base():
    response = client.get(f"/nx/BASE/{GAME_ID}")
    assert response.status_code == 200
    assert response.json().get("type") == "base"

def test_get_nx_dlc():
    response = client.get(f"/nx/DLC/{GAME_ID}")
    if response.status_code == 200:
        assert response.json().get("type") == "dlc"
    else:
        assert response.status_code == 400

def test_get_nx_update():
    response = client.get(f"/nx/UPDATE/{GAME_ID}")
    if response.status_code == 200:
        assert response.json().get("type") == "update"
    else:
        assert response.status_code == 400

def test_get_unsupported_platform():
    response = client.get(f"/ps5/{GAME_ID}")
    assert response.status_code == 404 # notice how there are no games on ps5

def test_get_nonexistent_game():
    response = client.get("/nx/jadeisbetterthanyou")
    assert response.status_code == 404
