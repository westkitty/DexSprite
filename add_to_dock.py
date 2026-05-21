import os
import sys
import subprocess
import plistlib

# Dex Sprite — macOS Dock Integration Script

plist_path = os.path.expanduser("~/Library/Preferences/com.apple.dock.plist")

if not os.path.exists(plist_path):
    print("Error: com.apple.dock.plist not found.", file=sys.stderr)
    sys.exit(1)

print("==> Loading com.apple.dock.plist preferences...")

try:
    with open(plist_path, 'rb') as fp:
        dock_data = plistlib.load(fp)
except Exception as e:
    print(f"Error loading plist: {e}", file=sys.stderr)
    sys.exit(1)

# Check persistent-apps
persistent_apps = dock_data.get('persistent-apps', [])

# Check if DexSprite is already added
app_path = "file:///Applications/Dex%20Sprite.app/"
already_exists = False

for app in persistent_apps:
    tile_data = app.get('tile-data', {})
    file_data = tile_data.get('file-data', {})
    url_str = file_data.get('_CFURLString', '')
    if app_path.lower() in url_str.lower() or "/Applications/Dex Sprite.app".lower() in url_str.lower():
        already_exists = True
        break

if already_exists:
    print("==> Dex Sprite is already present in your Dock. Skipping duplicate insert.")
else:
    print("==> Dex Sprite not found on Dock. Adding new file tile...")
    
    # Construct standard macOS Dock persistent application tile dictionary
    new_tile = {
        'tile-data': {
            'file-data': {
                '_CFURLString': app_path,
                '_CFURLFileType': 0
            },
            'file-label': 'Dex Sprite',
            'file-type': 41 # Application type identifier
        },
        'tile-type': 'file-tile'
    }
    
    persistent_apps.append(new_tile)
    dock_data['persistent-apps'] = persistent_apps
    
    try:
        with open(plist_path, 'wb') as fp:
            plistlib.dump(dock_data, fp)
        print("==> Saved com.apple.dock.plist successfully.")
    except Exception as e:
        print(f"Error saving plist: {e}", file=sys.stderr)
        sys.exit(1)

    print("==> Restarting macOS Dock to apply changes...")
    subprocess.run(["killall", "Dock"], check=True)
    print("==> Success! Dex Sprite has been added to your macOS Dock.")
