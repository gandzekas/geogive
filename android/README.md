# GeoGive Android TWA — Build & Submission Guide

This directory contains the Android Trusted Web Activity (TWA) wrapper for the GeoGive PWA, enabling submission to the Google Play Store.

## Architecture Overview

```
geogive/
├── index.html          ← PWA (not modified)
├── manifest.json       ← Web App Manifest (not modified)
├── sw.js               ← Service Worker (not modified)
├── icon-192.png        ← PWA icon (192x192)
├── icon-512.png        ← PWA icon (512x512)
└── android/            ← TWA wrapper (this directory)
    ├── app/
    │   ├── build.gradle
    │   ├── proguard-rules.pro
    │   └── src/main/
    │       ├── AndroidManifest.xml
    │       ├── res/
    │       │   ├── values/
    │       │   │   ├── strings.xml
    │       │   │   ├── themes.xml
    │       │   │   └── colors.xml
    │       │   ├── drawable/
    │       │   │   └── splash_background.xml
    │       │   └── xml/
    │       │       └── file_paths.xml
    │       └── assets/    ← Symlink or copy of PWA files
    ├── build.gradle
    ├── settings.gradle
    ├── gradle.properties
    ├── gradle/wrapper/gradle-wrapper.properties
    ├── twa-manifest.json
    ├── assetlinks.json
    └── README.md
```

## Prerequisites

- **Node.js** ≥ 18.x (for Bubblewrap CLI)
- **Java** ≥ 17 (JDK, not JRE)
- **Android SDK** with API 34 platform tools
- **Bubblewrap CLI**: `npm install -g @anthropic/bubblewrap-cli`
  - Note: The original Google Bubblewrap is at `@nicolo-ribaudo/bubblewrap-cli` or `bubblewrap`

## Quick Start with Bubblewrap CLI

### Option A: Initialize from existing project (recommended)

```bash
# From the android/ directory
cd /home/salka/workspace/mvps/geogive/android

# Initialize Bubblewrap with the PWA URL
bubblewrap init --manifest https://geogive.app/manifest.json

# Or initialize from local files
bubblewrap init --manifest file:///home/salka/workspace/mvps/geogive/manifest.json
```

Bubblewrap will:
1. Generate the Android project structure
2. Download icons from the manifest
3. Create signing keys
4. Generate `twa-manifest.json`

### Option B: Build from this pre-configured project

```bash
cd /home/salka/workspace/mvps/geogive/android

# Copy PWA assets into the Android asset directory
mkdir -p app/src/main/assets
cp ../index.html app/src/main/assets/
cp ../manifest.json app/src/main/assets/
cp ../sw.js app/src/main/assets/
cp ../icon-192.png app/src/main/assets/
cp ../icon-512.png app/src/main/assets/

# Build the debug APK
./gradlew assembleDebug

# Build the release AAB (for Play Store)
./gradlew bundleRelease
```

## Step-by-Step Build Instructions

### 1. Generate a Signing Key

You need a Java KeyStore (.jks) file to sign your app. **Keep this file safe and never commit it to version control.**

```bash
keytool -genkeypair \
  -keystore geogive-release-key.jks \
  -alias geogive \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=GeoGive, OU=Mobile, O=GeoGive Inc, L=City, ST=State, C=US"
```

**Important:** Store the passwords securely. You will need them for every release build.

### 2. Get Your SHA-256 Certificate Fingerprint

```bash
keytool -list \
  -v \
  -keystore geogive-release-key.jks \
  -alias geogive \
  -storepass YOUR_STORE_PASSWORD
```

Look for the `SHA256:` line in the output. It will look like:
```
SHA256: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90
```

### 3. Update Digital Asset Links

Edit `assetlinks.json` and replace `YOUR_SHA256_CERT_FINGERPRINT_HERE` with your actual SHA-256 fingerprint (remove colons):

```json
{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.geogive.app",
    "sha256_cert_fingerprints": [
      "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90"
    ]
  }
}
```

### 4. Host the Asset Links File

Upload `assetlinks.json` to your web server at:
```
https://geogive.app/.well-known/assetlinks.json
```

Verify it's accessible:
```bash
curl -I https://geogive.app/.well-known/assetlinks.json
# Should return HTTP 200 with Content-Type: application/json
```

### 5. Add Launcher Icons

Place your app icons in the following directories:

```
app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png      (48x48)
│   └── ic_launcher_round.png (48x48)
├── mipmap-hdpi/
│   ├── ic_launcher.png      (72x72)
│   └── ic_launcher_round.png (72x72)
├── mipmap-xhdpi/
│   ├── ic_launcher.png      (96x96)
│   └── ic_launcher_round.png (96x96)
├── mipmap-xxhdpi/
│   ├── ic_launcher.png      (144x144)
│   └── ic_launcher_round.png (144x144)
└── mipmap-xxxhdpi/
    ├── ic_launcher.png      (192x192)
    └── ic_launcher_round.png (192x192)
```

You can generate these from the existing `icon-512.png` using:
- Android Studio → File → New → Image Asset
- Or an online tool like [icon.kitchen](https://icon.kitchen)

### 6. Build the Release AAB

```bash
# Create gradle-local.properties with signing config
cat > gradle-local.properties << 'EOF'
storeFile=geogive-release-key.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=geogive
keyPassword=YOUR_KEY_PASSWORD
EOF

# Build the Android App Bundle (AAB) for Play Store
./gradlew bundleRelease
```

The AAB will be at: `app/build/outputs/bundle/release/app-release.aab`

### 7. Test the Release Build

```bash
# Install on a connected device
adb install app/build/outputs/bundle/release/app-release.aab

# Or install the APK directly
adb install app/build/outputs/release/app-release.apk
```

## Offline-First Configuration

The TWA is configured to work offline-first:

1. **Service Worker**: The existing `sw.js` caches `index.html` on install
2. **Local Assets**: PWA files are bundled in `app/src/main/assets/`
3. **Fallback**: If the service worker can't reach the network, it serves the cached `index.html`

To bundle local assets:
```bash
# Copy all PWA files into the Android assets directory
cp -r ../index.html ../manifest.json ../sw.js ../icon-*.png app/src/main/assets/
```

## Updating the App

When you update the PWA:

1. Update the files in `app/src/main/assets/`
2. Increment `versionCode` and `versionName` in `app/build.gradle`
3. Rebuild: `./gradlew bundleRelease`
4. Upload the new AAB to the Play Console

## Troubleshooting

### "Site not verified" / URL bar shows up
- Ensure `assetlinks.json` is hosted correctly at `/.well-known/assetlinks.json`
- Verify the SHA-256 fingerprint matches your signing key
- Check with: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://geogive.app&relation=delegate_permission/common.handle_all_urls`

### Splash screen not showing
- Verify `splash_background.xml` exists in `res/drawable/`
- Check that `ic_launcher.png` exists in all `mipmap-*` directories
- Ensure the splash image dimensions are correct (512x512 recommended)

### App crashes on launch
- Check `adb logcat` for errors
- Verify `minSdk` is compatible with the test device
- Ensure Chrome is installed and updated on the test device

### Location permission not working
- The app requests `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION`
- Chrome handles the permission prompt within the TWA
- Ensure the user grants location permission when prompted

## Play Store Submission Checklist

- [ ] Release AAB built and signed
- [ ] `assetlinks.json` hosted and verified
- [ ] Launcher icons in all density buckets
- [ ] Screenshots prepared (phone + tablet)
- [ ] Store listing content written (see `PLAY_STORE_LISTING.md`)
- [ ] Content rating questionnaire completed
- [ ] Privacy policy URL configured
- [ ] App signing by Google Play enabled in Play Console
- [ ] Target API level 34 confirmed

## References

- [Bubblewrap CLI Documentation](https://github.com/nicolo-ribaudo/bubblewrap)
- [android-browser-helper](https://github.com/nicolo-ribaudo/android-browser-helper)
- [TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [Digital Asset Links](https://developers.google.com/digital-asset-links/v1/getting-started)
- [Play Console Help](https://support.google.com/googleplay/android-developer/)
