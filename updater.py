import os
import sys
import requests
import yaml
import shutil
import zipfile
import time

VERSION_FILE = "version.txt"

# Change directory to the main.py dir
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def restart_script():
    authorized_hour = config['update-hour']
    
    while True:
        current_hour = int(time.strftime("%H"))
        if current_hour == authorized_hour:
            python = sys.executable
            if os.path.exists(python):
                os.execv(python, [f'"{python}"'] + sys.argv)
            else:
                print(f"Error: Python executable not found at {python}. Could not restart API.")
            break
        else:
            print(f"Waiting for authorized hour {authorized_hour}:00 to restart. Current hour: {current_hour}:00")
            time.sleep(60)  # Wait for 1 minute before checking again
    
# Step 1: Read config.yml
def load_config():
    with open('config.yml', 'r') as file:
        config = yaml.safe_load(file)
        config['update-source'] = config.get('update-source', 'ghost-land/Nlib-API')
        config['update-hour'] = config.get('update-hour', 5)
        config['auto-update-enabled'] = config.get('auto-update-enabled', True)
    return config

config = load_config()


# Step 2: Get latest release from GitHub
def get_latest_release(repo):
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    else:
        return None

# Step 3: Check the build status
def check_build_status(repo, commit_sha):
    url = f"https://api.github.com/repos/{repo}/commits/{commit_sha}/status"
    retry_count = 0
    max_retries = 12  # 1 minute / 5 seconds = 12 retries

    while retry_count < max_retries:
        response = requests.get(url)
        if response.status_code == 200:
            status = response.json().get('state')
            if status == 'success':
                return True
            elif status != 'pending':
                return False
        
        # If status is 'pending' or request failed, wait and retry
        time.sleep(5)
        retry_count += 1

    # If still 'pending' after 1 minute, assume debug mode and update
    return True

# Step 4: Read the current installed version
def get_installed_version():
    if os.path.exists(VERSION_FILE):
        with open(VERSION_FILE, 'r') as file:
            return file.read().strip()
    return "v1.0.0"

# Step 5: Write the new version to version.txt
def set_installed_version(version):
    with open(VERSION_FILE, 'w') as file:
        file.write(version)

# Step 6: Update the server
def update_to_latest_release(tag_name):
    repo = config['update-source']
    url = f"https://api.github.com/repos/{repo}/releases/tags/{tag_name}"
    response = requests.get(url)
    if response.status_code == 200:
        release_data = response.json()
        zipball_url = release_data['zipball_url']
        
        # Download the zipball
        zip_response = requests.get(zipball_url)
        with open('temp.zip', 'wb') as f:
            f.write(zip_response.content)
        
        # Extract and merge the contents
        with zipfile.ZipFile('temp.zip', 'r') as zip_ref:
            root_dir = zip_ref.namelist()[0].split('/')[0]  # Get the root directory name
            for file in zip_ref.namelist():
                if file.startswith(root_dir + '/'):
                    relative_path = file[len(root_dir) + 1:]
                    if not relative_path:
                        continue
                    extracted_path = zip_ref.extract(file, 'temp_extract')
                    dest_path = os.path.join(os.getcwd(), relative_path)
                    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                    
                    if os.path.exists(dest_path):
                        if relative_path == 'config.yml':
                            # Merge config.yml
                            with open(dest_path, 'r') as existing_file, open(extracted_path, 'r') as new_file:
                                existing_config = yaml.safe_load(existing_file)
                                new_config = yaml.safe_load(new_file)
                                for key, value in new_config.items():
                                    if key not in existing_config:
                                        existing_config[key] = value
                            with open(dest_path, 'w') as merged_file:
                                yaml.dump(existing_config, merged_file)
                        else:
                            # Overwrite other files
                            try:
                                shutil.copy2(extracted_path, dest_path)
                            except (PermissionError, IsADirectoryError) as e:
                                print(f"Error: {e}. Skipping file: {dest_path}.")
                                pass
                    else:
                        shutil.copy2(extracted_path, dest_path)
        
        # Clean up
        os.remove('temp.zip')
        shutil.rmtree('temp_extract')
    
    set_installed_version(tag_name)

# Main updater logic
def auto_update(startup=False):
    if config.get('auto-update-enabled', True) is False:
        return
    
    repo = config.get('update-source')

    # Get the latest release
    latest_release = get_latest_release(repo)
    if not latest_release:
        print("Failed to get the latest release.")
        return

    release_tag = latest_release['tag_name']
    last_commit_sha = latest_release['target_commitish']

    # Check if the installed version is the same as the latest
    installed_version = get_installed_version()
    if installed_version == release_tag:
        print(f"Already up to date (version: {installed_version}).")
        return

    # Check build status
    if check_build_status(repo, last_commit_sha):
        print(f"Build successful. Updating to {release_tag}.")
        update_to_latest_release(release_tag)
        if __name__ != "__main__" and not startup:
            restart_script()
    else:
        print("Build failed or not successful. Update aborted.")

if __name__ == "__main__":
    auto_update()
