import os
import sys
import subprocess
import plistlib
import random

# Dex Sprite — macOS Dock Integration Script (using defaults export/import for cfprefsd synchronization)

print("==> Exporting current com.apple.dock preferences via defaults...")
try:
    # Export current synced Dock state from cfprefsd
    res = subprocess.run(["defaults", "export", "com.apple.dock", "-"], capture_output=True, check=True)
    dock_data = plistlib.loads(res.stdout)
except Exception as e:
    print(f"Error exporting plist from defaults: {e}", file=sys.stderr)
    sys.exit(1)

# Check persistent-apps
persistent_apps = dock_data.get('persistent-apps', [])

# Check if Dex Sprite is already added
app_path = "file:///Applications/Dex%20Sprite.app/"
already_exists = False

for app in persistent_apps:
    tile_data = app.get('tile-data', {})
    file_data = tile_data.get('file-data', {})
    url_str = file_data.get('_CFURLString', '')
    bundle_id = tile_data.get('bundle-identifier', '')
    if (app_path.lower() in url_str.lower() or 
        "/Applications/Dex Sprite.app".lower() in url_str.lower() or 
        bundle_id == "com.andrew.DexSprite"):
        already_exists = True
        break

if already_exists:
    print("==> Dex Sprite is already present in your Dock. Skipping duplicate insert.")
else:
    print("==> Dex Sprite not found on Dock. Adding new file tile...")
    
    # Construct standard macOS Dock persistent application tile dictionary
    new_tile = {
        'GUID': random.randint(1000000000, 9999999999),
        'tile-data': {
            'file-data': {
                '_CFURLString': app_path,
                '_CFURLFileType': 0,
                '_CFURLStringType': 15
            },
            'file-label': 'Dex Sprite',
            'file-type': 41, # Application type identifier
            'bundle-identifier': 'com.andrew.DexSprite'
        },
        'tile-type': 'file-tile'
    }
    
    persistent_apps.append(new_tile)
    dock_data['persistent-apps'] = persistent_apps
    
    # Write to a temporary file inside the workspace
    temp_plist_path = "temp_dock.plist"
    try:
        with open(temp_plist_path, 'wb') as fp:
            plistlib.dump(dock_data, fp)
        
        # Import back to defaults system to force cfprefsd syncing
        subprocess.run(["defaults", "import", "com.apple.dock", temp_plist_path], check=True)
        print("==> Imported updated preferences via defaults successfully.")
    except Exception as e:
        print(f"Error saving or importing plist: {e}", file=sys.stderr)
        if os.path.exists(temp_plist_path):
            os.remove(temp_plist_path)
        sys.exit(1)
    finally:
        if os.path.exists(temp_plist_path):
            os.remove(temp_plist_path)

    print("==> Restarting macOS Dock to apply changes...")
    subprocess.run(["killall", "Dock"], check=True)
    print("==> Success! Dex Sprite has been added to your macOS Dock.")
