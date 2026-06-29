# GeoGive

GeoGive is a mobile-first PWA/TWA for listing and requesting free items nearby.

## What it does

People can create local giveaway listings, browse items on a map or list, request items, coordinate through chat, rate completed handoffs, and wrap the same PWA as an Android Trusted Web Activity.

## Tech stack

- Frontend: vanilla JavaScript, HTML, CSS
- Map: Leaflet with OpenStreetMap tiles
- Backend: Supabase Auth, Postgres, Storage, and Realtime
- Mobile: Android TWA wrapper in `android/`
- CI: GitHub Actions builds APK, signed APK, and AAB

## Local development

```bash
npm ci
npm run lint:html
npm run lint:js
node test_app.js
```

The dev server is only for desktop debugging. Mobile OAuth and geolocation require an HTTPS production URL, not a phone hitting Termux localhost.

## PWA and TWA URLs

Current aligned PWA/TWA target:

- PWA URL: `https://gandzekas.github.io/geogive/index.html`
- Manifest URL: `https://gandzekas.github.io/geogive/manifest.json`
- TWA start URL: `/geogive/index.html`
- TWA scope: `/geogive/`

Keep these in sync:

- `manifest.json`
- `android/app/src/main/assets/manifest.json`
- `android/twa-manifest.json`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/values/strings.xml`
- `.well-known/assetlinks.json`
- `assetlinks.json`

## Supabase configuration

Do not hardcode Supabase credentials in HTML or committed files. Configure the project in the running app settings panel or inject values through a safe build/runtime mechanism. The public Supabase anon key is not a server secret, but it should still be rotated if it was previously exposed in committed history.

## Android release

Use GitHub Actions for real APK/AAB builds on x86_64. Termux/Android ARM local Gradle builds commonly fail because AAPT2 is distributed as an x86_64 binary.

Required GitHub Actions secrets:

- `GEOGIVE_KEYSTORE_BASE64`
- `GEOGIVE_STORE_PASSWORD`
- `GEOGIVE_KEY_PASSWORD`

The workflow verifies that the Asset Links fingerprint matches the decoded keystore before publishing release artifacts.

## Digital Asset Links caveat

DAL verification is origin-based. For a GitHub Pages project path like `https://gandzekas.github.io/geogive/`, DAL checks `https://gandzekas.github.io/.well-known/assetlinks.json`, not the project path. Use a custom domain or a user/org Pages root for verified TWA links.

## Implemented app flows

- Supabase-backed auth scaffolding with Google OAuth and email sign-in paths
- Item create, browse, filter, renew, delete, and mark-given flows
- Request accept/decline flow
- Chat flow for accepted requests
- Reports and ratings
- Profile edit and avatar/name display
- Local in-app notification state
- Offline action queue scaffolding
- Service worker/offline cache scaffolding

## Explicitly not implemented

- Payment processing
- Real FCM push notifications
- Play Store metadata/screenshots
- Privacy policy page
- End-to-end on-device auth/data/map smoke tests

Those are not done-done until implemented and verified.

## Release checklist

- [ ] CI builds debug APK, signed release APK, and AAB
- [ ] APK/AAB artifacts are downloaded and installed on a real Android device
- [ ] TWA opens the HTTPS PWA URL
- [ ] Digital Asset Links verifies for the actual release keystore and origin
- [ ] Google OAuth works on production
- [ ] Email auth behavior matches Supabase email confirmation settings
- [ ] Create/list/request/chat/report/rate flows pass on device
- [ ] Map/geolocation works over HTTPS
- [ ] PWA installability works
- [ ] Supabase schema, RLS, and storage rules match the client code
