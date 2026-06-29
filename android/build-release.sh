#!/bin/bash
# Builds the GeoGive TWA release bundle.
#
# On Termux/ARM this script prepares the Android assets and then points you at
# the GitHub Actions release workflow, because the Android Gradle AAPT2 binary
# available in this Termux cache is x86_64-only and cannot package resources on
# arm64 Android.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="${ROOT_DIR}/android"

echo "========================================="
echo "  GeoGive TWA — Release Build Prep"
echo "========================================="
echo ""

cd "${ROOT_DIR}"

python - <<'PY'
from pathlib import Path
import shutil
root = Path('.')
assets = root / 'android/app/src/main/assets'
if assets.exists():
    shutil.rmtree(assets)
assets.mkdir(parents=True, exist_ok=True)
for name in ['index.html', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png']:
    shutil.copy2(root / name, assets / name)
for dirname in ['css', 'js']:
    src = root / dirname
    dst = assets / dirname
    if src.exists():
        shutil.copytree(src, dst)
for density in ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']:
    d = root / 'android/app/src/main/res' / f'mipmap-{density}'
    d.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / 'icon-192.png', d / 'ic_launcher.png')
    shutil.copy2(root / 'icon-192.png', d / 'ic_launcher_round.png')
print('Prepared Android assets, PWA files, and launcher icons.')
PY

ARCH="$(uname -m)"
case "${ARCH}" in
  aarch64|arm64)
    echo ""
    echo "⚠️  Termux/ARM detected (${ARCH})."
    echo "Local Android resource packaging is blocked here because AAPT2 in this"
    echo "Gradle cache is x86_64-only. Use the GitHub Actions workflow instead:"
    echo "  .github/workflows/build.yml"
    echo ""
    echo "Required GitHub secrets:"
    echo "  GEOGIVE_KEYSTORE_BASE64"
    echo "  GEOGIVE_STORE_PASSWORD"
    echo "  GEOGIVE_KEY_PASSWORD"
    exit 2
    ;;
esac

if [ ! -f "${ANDROID_DIR}/gradle-local.properties" ]; then
  echo "❌ ERROR: ${ANDROID_DIR}/gradle-local.properties not found."
  echo "   Create it with your signing key credentials before building release."
  echo "   storeFile=geogive-release-key.jks"
  echo "   storePassword=YOUR_STORE_PASSWORD"
  echo "   keyAlias=geogive"
  echo "   keyPassword=YOUR_KEY_PASSWORD"
  exit 1
fi

cd "${ANDROID_DIR}"
chmod +x gradlew
./gradlew bundleRelease

echo ""
echo "Output: ${ANDROID_DIR}/app/build/outputs/bundle/release/app-release.aab"
