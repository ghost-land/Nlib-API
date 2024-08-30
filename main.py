import yaml
import os
import sys
from fastapi import FastAPI, Response, HTTPException

def load_config():
    with open('config.yml', 'r') as config_file:
        config = yaml.safe_load(config_file)
        config['app-host'] = config.get('app-host', '0.0.0.0')
        config['app-port'] = config.get('app-port', 80)
        config['database-path'] = config.get('database-path', '/data/NX-DB')
        
        return config

config = load_config()

# Check if 'database-path' is valid and existing
if 'database-path' not in config or not os.path.exists(config['database-path']):
    print("Error: 'database-path' is not set or does not exist.")
    sys.exit(1)

app = FastAPI()


@app.head('/nx/{tid}')
@app.get('/nx/{tid}')
async def get_nx(tid: str):
    base_path = os.path.join(config['database-path'], 'base', f'{tid}.json')
    dlc_path = os.path.join(config['database-path'], 'dlc', f'{tid}.json')
    update_path = os.path.join(config['database-path'], 'update', f'{tid}.json')

    if os.path.exists(base_path):
        with open(base_path, 'r') as file:
            content = file.read()
        return Response(content=content, media_type="application/json")
    elif os.path.exists(dlc_path):
        with open(dlc_path, 'r') as file:
            content = file.read()
        return Response(content=content, media_type="application/json")
    elif os.path.exists(update_path):
        with open(update_path, 'r') as file:
            content = file.read()
        return Response(content=content, media_type="application/json")
    else:
        raise HTTPException(status_code=404, detail="Item not found")

@app.head('/uptime')
def uptime():
    return '', 200

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(
        app,
        host=config['app-host'],
        port=config['app-port']
    )