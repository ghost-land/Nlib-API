import os
import sys
import time
import yaml
import json
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from time import time
from collections import defaultdict
from utils.resize_image import resize_image, nearest_size
import updater

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
DEBUG = False

# Perform auto-update on startup if not running in GitHub Actions and auto-update is enabled in config
if 'GITHUB_ACTIONS' not in os.environ and config.get('auto-update-on-startup', False):
    updater.auto_update(startup=True)

# Check if 'database-path' is valid and existing
if 'database-path' not in config or not os.path.exists(config['database-path']):
    print("Error: 'database-path' is not set or does not exist.")
    sys.exit(1)

app = FastAPI(redirect_slashes=False)

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


# Custom caching system
cache = {}
cache_max_size = 128
def find_id_type(tid: str):
    tid = str(tid)
    
    # Check if result is in cache
    if tid in cache:
        return cache[tid]
    
    base_path = os.path.join(config['database-path'], 'base', f'{tid.upper()}.json')
    dlc_path = os.path.join(config['database-path'], 'dlc', f'{tid.upper()}.json')
    update_path = os.path.join(config['database-path'], 'update', f'{tid.upper()}.json')

    if os.path.exists(base_path):
        result = ('nx', 'base', base_path)
    elif os.path.exists(dlc_path):
        result = ('nx', 'dlc', dlc_path)
    elif os.path.exists(update_path):
        result = ('nx', 'update', update_path)
    else:
        retro_path = os.path.join(config['database-path'], 'retro')
        if os.path.exists(retro_path):
            # Try with lowercase tid first for retro
            tid_lower = tid.lower()
            for console in os.listdir(retro_path):
                console_path = os.path.join(retro_path, console, f'{tid_lower}.json')
                if os.path.exists(console_path):
                    result = (console, 'retro', console_path)
                    break
            else:
                # If not found, try with uppercase tid
                tid_upper = tid.upper()
                for console in os.listdir(retro_path):
                    console_path = os.path.join(retro_path, console, f'{tid_upper}.json')
                    if os.path.exists(console_path):
                        result = (console, 'retro', console_path)
                        break
                else:
                    result = (None, None, None)
        else:
            result = (None, None, None)
    
    # Add result to cache
    if len(cache) >= cache_max_size:
        cache.pop(next(iter(cache)))  # Remove oldest item
    if result != (None, None, None):
        cache[tid] = result
    
    return result

# Custom cache for game screenshots
screenshot_cache = {}
screenshot_cache_max_size = 128
def get_game_screenshot(tid: str, screen_id: int):
    cache_key = f"{tid}_{screen_id}"
    
    # Check if result is in cache
    if cache_key in screenshot_cache:
        return screenshot_cache[cache_key]
    
    screen_path = os.path.join(config['database-path'], 'media', f'{tid}', 'screens', f'screen_{screen_id}.jpg')
    if os.path.exists(screen_path):
        with open(screen_path, 'rb') as file:
            screenshot = file.read()
        
        # Add result to cache
        if len(screenshot_cache) >= screenshot_cache_max_size:
            screenshot_cache.pop(next(iter(screenshot_cache)))  # Remove oldest item
        screenshot_cache[cache_key] = screenshot
        
        return screenshot
    
    return None

def get_screenshots(tid: str):
    screenshots_dir = os.path.join(config['database-path'], 'media', f'{tid}', 'screens')
    if os.path.exists(screenshots_dir):
        screenshot_urls = [f"https://{config['domain']}/nx/{tid}/screen/{i+1}" for i in range(len([f for f in os.listdir(screenshots_dir) if f.endswith('.jpg')]))]
        screenshot_urls.sort()
        count = len(screenshot_urls)
        return {"count": count, "screenshots": screenshot_urls}
    else:
        return {"count": 0, "screenshots": []}
                
# Custom cache for game icons
icon_cache = {}
icon_cache_max_size = 128
def get_game_icon(tid, size: tuple = (1024, 1024)):
    cache_key = f"{tid}_{size}"
    
    # Check if result is in cache
    if cache_key in icon_cache:
        return icon_cache[cache_key]
    
    icon_path = os.path.join(config['database-path'], 'media', f'{tid}', 'icon.jpg')
    icon_path = resize_image(icon_path, *size)
    if not icon_path:
        return None
    if os.path.exists(icon_path):
        with open(icon_path, 'rb') as file:
            icon = file.read()
        
        # Add result to cache
        if len(icon_cache) >= icon_cache_max_size:
            icon_cache.pop(next(iter(icon_cache)))  # Remove oldest item
        icon_cache[cache_key] = icon
        
        return icon
    
    return None

# Custom cache for game banners
banner_cache = {}
banner_cache_max_size = 128
def get_game_banner(tid, size: tuple = (1920, 1080)):
    cache_key = f"{tid}_{size}"
    
    # Check if result is in cache
    if cache_key in banner_cache:
        return banner_cache[cache_key]
    
    banner_path = os.path.join(config['database-path'], 'media', f'{tid}', 'banner.jpg')
    banner_path = resize_image(banner_path, *size)
    if not banner_path:
        return None
    if os.path.exists(banner_path):
        with open(banner_path, 'rb') as file:
            banner = file.read()
        
        # Add result to cache
        if len(banner_cache) >= banner_cache_max_size:
            banner_cache.pop(next(iter(banner_cache)))  # Remove oldest item
        banner_cache[cache_key] = banner
        
        return banner
    
    return None

fulldb_cache = None
fulldb_last_modified = 0
def get_fulldb() -> str:
    global fulldb_cache, fulldb_last_modified
    
    file_path = os.path.join(config['database-path'], 'fulldb.json')
    current_modified_time = os.path.getmtime(file_path)
    
    if fulldb_cache is None or current_modified_time > fulldb_last_modified:
        with open(file_path, 'r') as file:
            fulldb_cache = file.read()
        fulldb_last_modified = current_modified_time
    
    return fulldb_cache

# Load db on startup
get_fulldb()


def format_date(date: int) -> str:
    return f"{date // 10000:04d}-{date % 10000 // 100:02d}-{date % 100:02d}"

def format_json_dates(data: dict) -> dict:
    date_fields = ['releaseDate', 'base_release_date', 'first_update_release_date', 'latest_update_release_date']
    
    for field in date_fields:
        if field in data:
            data[field] = format_date(data[field])
    
    if 'latest_update' in data and 'release_date' in data['latest_update']:
        data['latest_update']['release_date'] = format_date(data['latest_update']['release_date'])
    
    if 'versions' in data:
        data['versions'] = {version: format_date(date) for version, date in data['versions'].items()}
    
    return data


@app.get('/{platform}/{tid}')
@app.get('/{platform}/{tid}/')
@app.get('/{platform}/{tid}/{asset_type}')
@app.get('/{platform}/{tid}/{asset_type}/')
@app.get('/{platform}/{tid}/{asset_type}/{screen_id}')
@app.get('/{platform}/{tid}/{asset_type}/{screen_id}/')
@app.get('/{platform}/{tid}/{asset_type}/{screen_id}/{media_height}')
@app.get('/{platform}/{tid}/{asset_type}/{screen_id}/{media_height}/')
async def get_nx(platform: str, tid: str, asset_type: str = None, screen_id=1, media_height=None):
    if platform.lower() not in ['nx', 'switch']:
        raise HTTPException(status_code=404, detail=f"Platform {platform} not supported")
    
    if asset_type:
        asset_type = asset_type.lower()
    if tid:
        tid = tid.upper()
    
    console, id_type, file_path = find_id_type(tid)
    
    
    if tid in ['FULL', 'ALL']:
        # Handle full/all JSON file request
        if asset_type == 'download':
            return Response(content=get_fulldb(), media_type="application/octet-stream", headers={
                "Content-Disposition": f'attachment; filename="fulldb.json"'
            })
        return Response(content=get_fulldb(), media_type="application/json")
        
    
    # /nx/base/0100A0D004FB0000
    # /nx/<type>/<TID>
    elif tid in ['BASE', 'DLC', 'UPDATE', 'RETRO', 'FORWARDER']:
        type = tid
        tid = asset_type
        console, id_type, file_path = find_id_type(tid)
        
        if (console, id_type, file_path) == (None, None, None):
            asked_console = asset_type.lower()
            tid = screen_id
            console, id_type, file_path = find_id_type(tid)
            if id_type is not None:
                console = console.lower()
                if console != asked_console:
                    raise HTTPException(status_code=400, detail=f"Invalid console or title ID combination. Asked for console: {asked_console}, but title ID is for console: {console}")
            
        
        if id_type is None:
            raise HTTPException(status_code=404, detail="Item not found")
        if id_type.upper() != type.replace('FORWARDER','RETRO'):
            raise HTTPException(status_code=400, detail=f"The requested TID {tid} is not of type {type}")
    
        with open(file_path, 'r', encoding='utf-8') as file:
            content = json.load(file)
            content['console'] = console
            content['type'] = id_type
            content['screens'] = get_screenshots(tid)
            content = format_json_dates(content)
        return JSONResponse(content=content, media_type="application/json")
    
    if id_type:
        # nx/0100A0D004FB0000/icon
        if asset_type == 'icon':
            # Handle icon request
            try:
                width = int(screen_id)
            except ValueError:
                raise HTTPException(status_code=422, detail="Width must be an integer")
            height = media_height
            if height:
                try:
                    height = int(height)
                except ValueError:
                    raise HTTPException(status_code=422, detail="Height must be an integer")
            
            # Determine the height if not provided
            if width != 1 and not height:
                height = width
            if width == 1 and height:
                height = 1
            if width != height:
                width, height = 1024, 1024

            # Ensure width and height are nearest valid sizes
            width = nearest_size(width)
            height = nearest_size(height)
            
            content = get_game_icon(tid, size=(width, height))
            
            if content: 
                headers = {
                    "Content-Type": "image/jpeg",
                    "Content-Width": str(width),
                    "Content-Height": str(height),
                    "Content-Disposition": f'inline; filename="icon_{width}x{height}.jpg"'
                }
                return Response(content=content, headers=headers)
            else:
                raise HTTPException(status_code=404, detail=f"Icon for {tid} not found")
            
        # nx/0100A0D004FB0000/banner
        if asset_type == 'banner':
            # Handle banner request
            try:
                if screen_id in ["720p", "1080p"]:
                    width = {"720p": 1280, "1080p": 1920}[screen_id]
                    height = {"720p": 720, "1080p": 1080}[screen_id]
                else:
                    width = int(screen_id)
                    height = media_height
            except ValueError:
                raise HTTPException(status_code=422, detail="Width must be an integer or one of '720p' or '1080p'")
            
            if not height:
                height = 1080  # Default height for banners
            else:
                try:
                    height = int(height)
                except ValueError:
                    raise HTTPException(status_code=422, detail="Height must be an integer")
            
            # Ensure both width and height are provided
            if width == 1:
                width = 1920  # Default width for banners

            if width / height == 16 / 9:
                content = get_game_banner(tid, size=(width, height))
            else:
                raise HTTPException(status_code=422, detail="Width and height must maintain a 16:9 aspect ratio")
            
            if content: 
                headers = {
                    "Content-Type": "image/jpeg",
                    "Content-Width": str(width),
                    "Content-Height": str(height),
                    "Content-Disposition": f'inline; filename="banner_{width}x{height}.jpg"'
                }
                return Response(content=content, headers=headers)
            else:
                if width != 1920 or height != 1080:
                    raise HTTPException(status_code=422, detail="Resolution not accepted.")
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
            content = get_screenshots(tid)
            return JSONResponse(content=content, media_type="application/json")
            
        else:
            # Handle original JSON request
            # /nx/0100A0D004FB0000 (auto type)
            with open(file_path, 'r', encoding='utf-8') as file:
                content = json.load(file)
                content['console'] = console
                content['type'] = id_type
                content['screens'] = get_screenshots(tid)
                content = format_json_dates(content)
            return JSONResponse(content=content, media_type="application/json")
    else:
        raise HTTPException(status_code=404, detail="Item not found")


@app.get('/uptime')
@app.head('/uptime')
def uptime():
    return Response(status_code=200)


@app.post('/update-webhook')
async def update_webhook(request: Request):
    # Get the JSON payload from the request
    payload = await request.json()
    headers = dict(request.headers)
    
    # Check if the request is from GitHub
    if headers.get('user-agent', '').startswith('GitHub-Hookshot'):
        # Check if the action is a release
        if payload.get('action') == 'created' and 'release' in payload:
            updater.auto_update()
        
        return JSONResponse(content={"message": "Webhook received and processed successfully"}, status_code=200)
    else:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")


if DEBUG:
    @app.post('/webhook-debug')
    async def webhook(request: Request):
        # Get the raw request body
        body = await request.body()
        
        # Get all headers
        headers = dict(request.headers)
        
        # Get query parameters
        query_params = dict(request.query_params)
        
        # Get the client's IP address
        client_ip = request.client.host
        
        # Get the HTTP method
        http_method = request.method
        
        # Get the full URL
        url = str(request.url)
        
        # Prepare the response content
        content = {
            "method": http_method,
            "url": url,
            "client_ip": client_ip,
            "headers": headers,
            "query_params": query_params,
            "body": body.decode('utf-8')  # Decode bytes to string
        }
        
        # Print everything
        print(json.dumps(content, indent=2))
        
        return JSONResponse(content=content)


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(
        app,
        host=config['app-host'],
        port=config['app-port']
    )