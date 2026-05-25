#!/bin/bash
# build-release.sh
# Builds the GeoGive TWA release AAB for Play Store submission.
#
# PREREQUISITES:
#   - Java 17+ (JDK)
#   - Android SDK with API 34
#   - gradle-local.properties with signing config
#   - PWA assets copied to app/src/main/assets/
#   - Launcher icons in res/mipmap-*/
#
# USAGE:
#   chmod +x build-release.sh
#   ./build-release.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "========================================="
echo "  GeoGive TWA — Release Build"
echo "========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if [ ! -f "gradle-local.properties" ]; then
  echo "❌ ERROR: gradle-local.properties not found!"
  echo "   Create it with your signing key credentials:"
  echo "   storeFile=geogive-release-key.jks"
  echo "   storePassword=YOUR_STORE_PASSWORD"
  echo "   keyAlias=geogive"
  echo "   keyPassword=YOUR_KEY_PASSWORD"
  exit 1
fi

if [ ! -f "app/src/main/assets/index.html" ]; then
  echo "⚠️  WARNING: index.html not found in app/src/main/assets/"
  echo "   Copying PWA files now..."
  mkdir -p app/src/main/assets
  cp ../index.html app/src/main/assets/
  cp ../manifest.json app/src/main/assets/
  cp ../sw.js app/src/main/assets/
  cp ../icon-192.png app/src/main/assets/
  cp ../icon-512.png app/src/main/assets/
  echo "   ✅ PWA files copied."
fi

# Check for launcher icons
if [ ! -f "app/src/main/res/mipmap-hdpi/ic_launcher.png" ]; then
  echo "⚠️  WARNING: Launcher icons not found in res/mipmap-*/"
  echo "   You need to add ic_launcher.png and ic_launcher_round.png"
  echo "   in mipmap-mdpi, mipmap-hdpi, mipmap-xhdpi, mipmap-xxhdpi, mipmap-xxxhdpi"
  echo "   Using PWA icon as placeholder..."
  for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
    mkdir -p "app/src/main/res/mipmap-${density}"
    cp ../icon-192.png "app/src/main/res/mipmap-${density}/ic_launcher.png"
    cp ../icon-192.png "app/src/main/res/mipmap-${density}/ic_launcher_round.png"
  done
  echo "   ✅ Placeholder icons created (replace with proper icons before release)."
fi

echo ""
echo "Building release AAB..."
echo ""

# Make gradlew executable
chmod +x gradlew 2>/dev/null || true

# Build the release bundle
./gradlew bundleRelease

echo ""
echo "========================================="
echo "  BUILD COMPLETE"
echo "========================================="
echo ""
echo "Output: app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "Next steps:"
echo "  1. Upload app-release.aab to Google Play Console"
echo "  2. Complete the store listing (see PLAY_STORE_LISTING.md)"
echo "  3. Submit for review"
echo ""
