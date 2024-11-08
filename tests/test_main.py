import pytest
import warnings
from fastapi.testclient import TestClient
from main import app

warnings.filterwarnings("ignore", category=DeprecationWarning, message="The 'app' shortcut is now deprecated")
client = TestClient(app)

GAME_ID = "0100A0D004FB0000"
DLC_ID = "0100A0C00D847001"
UPDATE_ID = "0100997014004800"
FORWARDER_CONSOLE = "3Ds"
FORWARDER_ID_3DS = "0510800001e30000"
FORWARDER_ID_PSP = "0510300000ab0000"

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

def test_get_nx_icon_custom_size():
    response = client.get(f"/nx/{GAME_ID}/icon/512")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
        assert response.headers['content-width'] == '512'
    else:
        assert response.status_code == 404

def test_get_nx_icon_custom_width_height():
    response = client.get(f"/nx/{GAME_ID}/icon/512/512")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
        assert response.headers['content-width'] == '512'
        assert response.headers['content-height'] == '512'
    else:
        assert response.status_code == 404

def test_get_nx_icon_custom_dimension_512_500():
    response = client.get(f"/nx/{GAME_ID}/icon/512/500")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
        assert response.headers['content-width'] == '1024'
        assert response.headers['content-height'] == '1024'
    else:
        assert response.status_code == 404

def test_get_nx_icon_custom_dimension_1():
    response = client.get(f"/nx/{GAME_ID}/icon/1")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
        assert response.headers['content-width'] == '1024'
        assert response.headers['content-height'] == '1024'
    else:
        assert response.status_code == 404

def test_get_nx_icon_custom_dimension_1_1():
    response = client.get(f"/nx/{GAME_ID}/icon/1/1")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
        assert response.headers['content-width'] == '8'
        assert response.headers['content-height'] == '8'
    else:
        assert response.status_code == 404

def test_get_nx_icon_invalid_size():
    response = client.get(f"/nx/{GAME_ID}/icon/invalid")
    assert response.status_code == 422

def test_get_nx_icon_invalid_width_height():
    response = client.get(f"/nx/{GAME_ID}/icon/512/invalid")
    assert response.status_code == 422


def test_get_nx_banner():
    response = client.get(f"/nx/{GAME_ID}/banner")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
    else:
        assert response.status_code == 404

def test_get_nx_banner_custom_size():
    response = client.get(f"/nx/{GAME_ID}/banner/1280/720")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
        assert response.headers['content-width'] == '1280'
        assert response.headers['content-height'] == '720'
    else:
        assert response.status_code == 404

def test_get_nx_banner_720p():
    response = client.get(f"/nx/{GAME_ID}/banner/720p")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
        assert response.headers['content-width'] == '1280'
        assert response.headers['content-height'] == '720'
    else:
        assert response.status_code == 404

def test_get_nx_banner_1080p():
    response = client.get(f"/nx/{GAME_ID}/banner/1080p")
    if response.status_code == 200:
        assert response.headers['content-type'] == 'image/jpeg'
        assert response.headers['content-width'] == '1920'
        assert response.headers['content-height'] == '1080'
    else:
        assert response.status_code == 404

def test_get_nx_banner_480p():
    response = client.get(f"/nx/{GAME_ID}/banner/480p")
    assert response.status_code == 422
    
def test_get_nx_banner_invalid_resolution():
    response = client.get(f"/nx/{GAME_ID}/banner/16/9")
    assert response.status_code == 422
    
def test_get_nx_banner_invalid_ratio():
    response = client.get(f"/nx/{GAME_ID}/banner/1280/1280")
    assert response.status_code == 422

def test_get_nx_banner_invalid_size():
    response = client.get(f"/nx/{GAME_ID}/banner/invalid")
    assert response.status_code == 422

def test_get_nx_banner_invalid_width_height():
    response = client.get(f"/nx/{GAME_ID}/banner/1280/invalid")
    assert response.status_code == 422


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
    response = client.get(f"/nx/DLC/{DLC_ID}")
    assert response.status_code == 200
    assert response.json().get("type") == "dlc"

def test_get_nx_update():
    response = client.get(f"/nx/UPDATE/{UPDATE_ID}")
    assert response.status_code == 200
    assert response.json().get("type") == "update"

def test_nx_retro_endpoint():
    response = client.get(f"/nx/retro/{FORWARDER_ID_3DS}")
    assert response.status_code == 200
    assert response.json().get("type") == "retro"
    assert response.json().get("console") == "3ds"

def test_nx_forwarder_console_endpoint():
    response = client.get(f"/nx/forwarder/{FORWARDER_CONSOLE}/{FORWARDER_ID_3DS}")
    assert response.status_code == 200
    assert response.json().get("type") == "retro"
    assert response.json().get("console") == "3ds"

def test_nx_retro_correct_console():
    response = client.get(f"/nx/retro/psp/{FORWARDER_ID_PSP}")
    assert response.status_code == 200
    assert response.json().get("type") == "retro"
    assert response.json().get("console") == "psp"

def test_nx_retro_wrong_console():
    response = client.get(f"/nx/retro/psp/{FORWARDER_ID_3DS}")
    assert response.status_code == 400

def test_get_nonexistent_game():
    response = client.get("/nx/jadeisbetterthanyou")
    assert response.status_code == 404

def test_get_unsupported_platform():
    response = client.get(f"/ps5/{GAME_ID}")
    assert response.status_code == 404 # notice how there are no games on ps5