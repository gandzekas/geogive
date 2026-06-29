#!/bin/bash
# Sync web assets to Android TWA assets directory
# Run this before building the APK to ensure consistency

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ASSETS_DIR="$SCRIPT_DIR/app/src/main/assets"
WEB_DIR="$PROJECT_DIR"

echo "Syncing GeoGive web assets to Android TWA..."
echo "  Source: $WEB_DIR"
echo "  Dest:   $ASSETS_DIR"

# Sync JS files
for f in "$WEB_DIR"/js/*.js; do
  cp "$f" "$ASSETS_DIR/js/" && echo "  ✓ js/$(basename "$f")"
done

# Sync CSS files
for f in "$WEB_DIR"/css/*.css; do
  cp "$f" "$ASSETS_DIR/css/" && echo "  ✓ css/$(basename "$f")"
done

# Sync root web files
for f in sw.js index.html manifest.json icon-192.png icon-512.png; do
  if [ -f "$WEB_DIR/$f" ]; then
    cp "$WEB_DIR/$f" "$ASSETS_DIR/$f" && echo "  ✓ $f"
  fi
done

echo "Done! All web assets synced to Android TWA."
