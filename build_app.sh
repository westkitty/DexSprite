#!/bin/bash
set -e

# Dex Sprite — Native macOS Application Compiler & Bundler

echo "==> Initializing DexSprite.app compilation..."

# Workspace settings
PROJECT_DIR="/Users/andrew/Library/Mobile Documents/com~apple~CloudDocs/Projects/DexSprite"
SRC_IMAGE="/Users/andrew/.gemini/antigravity/brain/16e50b7e-1277-45da-b3a4-39377d66e189/dex_sprite_app_icon_1779339819995.png"
BUILD_DIR="$PROJECT_DIR/build"
APP_BUNDLE="$BUILD_DIR/Dex Sprite.app"

# 1. Clear previous builds
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources/www"

# 2. Compile custom AppIcon.icns
echo "==> Creating custom AppIcon.iconset from generated asset..."
ICONSET="$BUILD_DIR/AppIcon.iconset"
mkdir -p "$ICONSET"

# Resize images using macOS native sips utility
sips -s format png -z 16 16     "$SRC_IMAGE" --out "$ICONSET/icon_16x16.png"
sips -s format png -z 32 32     "$SRC_IMAGE" --out "$ICONSET/icon_16x16@2x.png"
sips -s format png -z 32 32     "$SRC_IMAGE" --out "$ICONSET/icon_32x32.png"
sips -s format png -z 64 64     "$SRC_IMAGE" --out "$ICONSET/icon_32x32@2x.png"
sips -s format png -z 128 128   "$SRC_IMAGE" --out "$ICONSET/icon_128x128.png"
sips -s format png -z 256 256   "$SRC_IMAGE" --out "$ICONSET/icon_128x128@2x.png"
sips -s format png -z 256 256   "$SRC_IMAGE" --out "$ICONSET/icon_256x256.png"
sips -s format png -z 512 512   "$SRC_IMAGE" --out "$ICONSET/icon_256x256@2x.png"
sips -s format png -z 512 512   "$SRC_IMAGE" --out "$ICONSET/icon_512x512.png"
sips -s format png -z 1024 1024 "$SRC_IMAGE" --out "$ICONSET/icon_512x512@2x.png"

echo "==> Compiling icons into AppIcon.icns..."
iconutil -c icns "$ICONSET" -o "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
rm -rf "$ICONSET"

# 3. Copy web application portal resources into www folder
echo "==> Bundling HTML5/CSS3/JS workspace resources..."
cp "$PROJECT_DIR/index.html" "$APP_BUNDLE/Contents/Resources/www/index.html"
cp "$PROJECT_DIR/style.css" "$APP_BUNDLE/Contents/Resources/www/style.css"
cp "$PROJECT_DIR/app.js" "$APP_BUNDLE/Contents/Resources/www/app.js"

# 4. Compile main.swift executable
echo "==> Compiling Swift Cocoa Application Wrapper..."
swiftc -sdk $(xcrun --show-sdk-path) -target arm64-apple-macosx13.0 "$PROJECT_DIR/src/main.swift" -o "$APP_BUNDLE/Contents/MacOS/Dex Sprite"

# 5. Create Info.plist file
echo "==> Writing Info.plist metadata file..."
cat <<EOF > "$APP_BUNDLE/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Dex Sprite</string>
    <key>CFBundleIdentifier</key>
    <string>com.andrew.DexSprite</string>
    <key>CFBundleName</key>
    <string>Dex Sprite</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# 6. Install to Applications folder
echo "==> Installing Dex Sprite.app into /Applications..."
rm -rf "/Applications/DexSprite.app"
rm -rf "/Applications/Dex Sprite.app"
cp -R "$APP_BUNDLE" "/Applications/Dex Sprite.app"

# Force Finder to invalidate all cached attributes of the bundle by updating its modification time
touch "/Applications/Dex Sprite.app"

echo "==> Registering application with macOS Launch Services..."
# Unregister the intermediate build directory bundle to avoid Launch Services launch conflicts
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -u "$APP_BUNDLE"
# Register the final bundle inside /Applications
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "/Applications/Dex Sprite.app"

echo "==> Flushing macOS Dock & Finder icon preferences caches..."
# Safely clear user-level launchservices and dock icon caches to force macOS to repaint the new icon instantly
rm -f /var/folders/*/*/*/com.apple.dock.iconcache 2>/dev/null || true
rm -rf /var/folders/*/*/*/com.apple.iconservices 2>/dev/null || true
killall Dock Finder || true

echo "==> Success! Dex Sprite.app has been successfully compiled, registered, and installed to /Applications/Dex Sprite.app."
