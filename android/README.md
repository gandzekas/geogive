# GeoGive Android TWA Build Guide

This directory contains the Gradle-based Trusted Web Activity wrapper for the GeoGive PWA.

## Current TWA target

- Package: `com.geogive.app`
- Default URL: `https://gandzekas.github.io/geogive/index.html`
- Web manifest: `https://gandzekas.github.io/geogive/manifest.json`
- `targetSdk`: `35`

## Local checks

Run these from the repository root before touching Android builds:

```bash
npm run lint:html
npm run lint:js
node --check test_app.js
find js -name '*.js' -print0 | xargs -0 -n1 node --check
find android/app/src/main/assets/js -name '*.js' -print0 | xargs -0 -n1 node --check
node test_app.js
./gradlew :app:processDebugManifest
```

`./gradlew assembleDebug` is expected to fail on Termux/Android ARM because the cached AAPT2 binary is x86_64-only. Use GitHub Actions or an x86_64 Linux runner for real APK/AAB builds.

## Asset sync

Do not hand-copy only one or two files. The CI workflow and `android/build-release.sh` replace `android/app/src/main/assets` with the current PWA files:

- `index.html`
- `manifest.json`
- `sw.js`
- `icon-192.png`
- `icon-512.png`
- `css/`
- `js/`

## Digital Asset Links

The release certificate fingerprint must match the keystore used by CI.

`assetlinks.json`, `.well-known/assetlinks.json`, and `android/assetlinks.json` must all contain:

- `package_name`: `com.geogive.app`
- the same SHA-256 certificate fingerprint as the release keystore
- fingerprint values with colons, for example `AA:BB:CC:...`

Verify locally after decoding or generating the real release keystore:

```bash
keytool -list -v -keystore geogive-release-key.jks -alias geogive
```

Then compare the `SHA256:` value with all three Asset Links files.

Important: Digital Asset Links verification is origin-based. For a GitHub Pages project site such as `https://gandzekas.github.io/geogive/`, DAL checks `https://gandzekas.github.io/.well-known/assetlinks.json`, not `https://gandzekas.github.io/geogive/.well-known/assetlinks.json`. Use a custom domain or a user/org Pages root if verified TWA links are required.

## Stable signing for CI

Do not generate a fresh signing key per workflow run. Play Store updates require the same keystore forever.

Required GitHub Actions secrets:

| Secret                    | Purpose                               |
| ------------------------- | ------------------------------------- |
| `GEOGIVE_KEYSTORE_BASE64` | Base64-encoded stable `.jks` keystore |
| `GEOGIVE_STORE_PASSWORD`  | Keystore password                     |
| `GEOGIVE_KEY_PASSWORD`    | Private key password                  |

The workflow decodes the keystore, creates `android/gradle-local.properties`, verifies the Asset Links fingerprint, builds debug APK, release APK, and release AAB.

## Release workflow

`.github/workflows/build.yml` runs on push to `main` or `master` and on manual dispatch:

1. `npm ci`
2. HTML lint
3. JavaScript lint
4. JavaScript syntax checks
5. `node test_app.js`
6. Sync PWA assets into Android assets
7. Process Android debug manifest
8. Decode stable signing keystore from GitHub secrets
9. Verify Asset Links fingerprint against that keystore
10. Build `assembleDebug`
11. Build `assembleRelease`
12. Build `bundleRelease`
13. Verify APK/AAB archives with `unzip -t`
14. Upload artifacts and publish a GitHub Release with APK/AAB assets

## Release outputs

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
- Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## What is not implemented here

GeoGive is a free giveaway app. There is no payment processor, Stripe, PayPal, crypto payout, or FCM push implementation. In-app notification state is local-only until a real backend notification path is added.

## References

- [TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [Digital Asset Links](https://developers.google.com/digital-asset-links/v1/getting-started)
- [GitHub Actions releases](https://github.com/softprops/action-gh-release)
