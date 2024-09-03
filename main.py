import os
import sys
import yaml
import json
from functools import lru_cache
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from time import time
from collections import defaultdict

# Change directory to the main.py dir
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def load_config():
    with open('config.yml', 'r') as config_file:
        config = yaml.safe_load(config_file)
        config['domain'] = config.get('domain', 'api.nlib.cc')
        config['app-host'] = config.get('app-host', '0.0.0.0')
        config['app-port'] = config.get('app-port', 80)
        config['database-path'] = './tests/test-db' if 'pytest' in sys.modules else config.get('database-path', '/data/NX-DB')
        
        config['limiter-enabled'] = False if 'pytest' in sys.modules else config.get('limiter-enabled', True)
        config['rate-limit'] = config.get('rate-limit', 1)
        config['rate-limit-period'] = config.get('rate-limit-period', 5)
        
        return config

config = load_config()

# Check if 'database-path' is valid and existing
if 'database-path' not in config or not os.path.exists(config['database-path']):
    print("Error: 'database-path' is not set or does not exist.")
    sys.exit(1)

app = FastAPI()

# In-memory store for request counts
request_counts = defaultdict(list)
RATE_LIMIT = config['rate-limit']  # Number of requests
RATE_LIMIT_PERIOD = config['rate-limit-period']  # Time period in seconds

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        current_time = time()
        request_times = request_counts[client_ip]

        # Remove old requests
        request_times = [t for t in request_times if current_time - t < RATE_LIMIT_PERIOD]
        request_counts[client_ip] = request_times

        if len(request_times) >= RATE_LIMIT:
            return JSONResponse(status_code=429, content={"detail": "Too many requests, please try again later."})

        # Add the current request time to the list
        request_times.append(current_time)
        request_counts[client_ip] = request_times

        # Process the request
        response = await call_next(request)
        return response

if config['limiter-enabled']:
    app.add_middleware(RateLimitMiddleware)


@lru_cache(maxsize=128)
def find_id_type(tid: str):
    base_path = os.path.join(config['database-path'], 'base', f'{tid}.json')
    dlc_path = os.path.join(config['database-path'], 'dlc', f'{tid}.json')
    update_path = os.path.join(config['database-path'], 'update', f'{tid}.json')

    if os.path.exists(base_path):
        return 'nx', 'base', base_path
    elif os.path.exists(dlc_path):
        return 'nx', 'dlc', dlc_path
    elif os.path.exists(update_path):
        return 'nx', 'update', update_path
    else:
        retro_path = os.path.join(config['database-path'], 'retro')
        if os.path.exists(retro_path):
            for console in os.listdir(retro_path):
                console_path = os.path.join(retro_path, console, f'{tid}.json')
                if os.path.exists(console_path):
                    return console, 'retro', console_path
                
        return None, None, None

@lru_cache(maxsize=128)
def get_game_screenshot(tid: str, screen_id: 1):
    screen_path = os.path.join(config['database-path'], 'media', f'{tid}', 'screens', f'screen_{screen_id}.jpg')
    if os.path.exists(screen_path):
        with open(screen_path, 'rb') as file:
            return file.read()
            
    return None

@lru_cache(maxsize=128)
def get_game_icon(tid, size: tuple = (1024, 1024)):
    icon_path = os.path.join(config['database-path'], 'media', f'{tid}', 'icon.jpg')
    if os.path.exists(icon_path):
        with open(icon_path, 'rb') as file:
            return file.read()

    return None

@lru_cache(maxsize=128)
def get_game_banner(tid, size: tuple = (1980, 1080)):
    icon_path = os.path.join(config['database-path'], 'media', f'{tid}', 'banner.jpg')
    if os.path.exists(icon_path):
        with open(icon_path, 'rb') as file:
            return file.read()

    return None


@app.get('/{platform}/{tid}')
@app.get('/{platform}/{tid}/{asset_type}')
@app.get('/{platform}/{tid}/{asset_type}/{screen_id}')
async def get_nx(platform: str, tid: str, asset_type: str = None, screen_id: int = 1):
    if platform.lower() not in ['nx', 'switch']:
        raise HTTPException(status_code=404, detail=f"Platform {platform} not supported")
    
    if asset_type:
        asset_type = asset_type.lower()
    if tid:
        tid = tid.upper()
    
    console, id_type, file_path = find_id_type(tid)
    
    
    if tid in ['FULL', 'ALL']:
        # Handle full/all JSON file request
        with open(os.path.join(config['database-path'], 'fulldb.json'), 'r') as file:
            return Response(status_code=200, content=file.read())
        
    if id_type is None:
        raise HTTPException(status_code=404, detail=f"TID {tid} not found")
    
    # /nx/base/0100A0D004FB0000
    elif tid in ['BASE', 'DLC', 'UPDATE']:
        type = tid
        tid = asset_type
        console, id_type, file_path = find_id_type(tid)
        
        if id_type.upper() != type:
            raise HTTPException(status_code=400, detail=f"The requested TID {tid} is not of type {type}")
    
        with open(file_path, 'r', encoding='utf-8') as file:
            content = json.load(file)
            content['console'] = console
            content['type'] = id_type
        return JSONResponse(content=content, media_type="application/json")

    if id_type:
        # nx/0100A0D004FB0000/icon
        if asset_type == 'icon':
            # Handle icon request
            content = get_game_icon(tid, size=(1024, 1024))
            if content: 
                return Response(content=content, media_type="image/jpeg")
            else:
                raise HTTPException(status_code=404, detail=f"Icon for {tid} not found")
            
        # nx/0100A0D004FB0000/banner
        if asset_type == 'banner':
            # Handle banner request
            content = get_game_banner(tid, size=(1980, 1080))
            if content: 
                return Response(content=content, media_type="image/jpeg")
            else:
                raise HTTPException(status_code=404, detail=f"Banner for {tid} not found")
            
        # nx/0100A0D004FB0000/screen
        # nx/0100A0D004FB0000/screen/4
        elif asset_type == 'screen':
            # Handle screenshot request
            content = get_game_screenshot(tid, screen_id)
            if content: 
                return Response(content=content, media_type="image/jpeg")
            else:
                raise HTTPException(status_code=404, detail=f"Screenshot {tid}:{screen_id} not found")
        
        # nx/0100A0D004FB0000/screens
        elif asset_type == 'screens':
            # Handle all screenshots request
            screenshots_dir = os.path.join(config['database-path'], 'media', f'{tid}', 'screens')
            if os.path.exists(screenshots_dir):
                screenshot_urls = [f"https://{config['domain']}/nx/{tid}/screen/{i+1}" for i in range(len([f for f in os.listdir(screenshots_dir) if f.endswith('.jpg')]))]
                screenshot_urls.sort()
                count = len(screenshot_urls)
                return JSONResponse(content={"count": count, "screenshots": screenshot_urls}, media_type="application/json")
            else:
                return JSONResponse(content={"count": 0, "screenshots": []}, media_type="application/json")
            
        else:
            # Handle original JSON request
            # /nx/0100A0D004FB0000 (auto type)
            with open(file_path, 'r', encoding='utf-8') as file:
                content = json.load(file)
                content['console'] = console
                content['type'] = id_type
            return JSONResponse(content=content, media_type="application/json")
    else:
        raise HTTPException(status_code=404, detail="Item not found")


@app.get('/uptime')
@app.head('/uptime')
def uptime():
    return Response(status_code=200)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(
        app,
        host=config['app-host'],
        port=config['app-port']
    )