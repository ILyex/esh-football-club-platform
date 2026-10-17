# ESH Matchday Android (TWA)

The Android app wraps the club's protected field-match PWA at `/ar/field/matches`. It uses the same platform account and authorization checks; Android notification delivery is delegated to the existing web push implementation.

## Preview build

- Preview origin: `https://esh-platform-vercel-preview.vercel.app`
- Package ID: `dz.esh.footballclub.field`
- Android project: `project/`
- Repository-safe TWA settings: `twa-manifest.json`
- Generated app settings: `project/twa-manifest.json`
- Minimum Android version: 7.0 (API 24), required by the current Android Browser Helper library.
- Build with `./build-preview.ps1`. It uses the locally installed Bubblewrap CLI, JDK 17 and Android SDK, then writes the signed APK and AAB into `project/`.

The preview signing key and its DPAPI-protected password are kept outside Git under `%LOCALAPPDATA%\ESH-Android-Build`. Keep both files backed up securely. The same key must sign future updates to this package.

The preview host serves the Android Digital Asset Links statement at `/.well-known/assetlinks.json` using the preview certificate fingerprint. This enables a verified Trusted Web Activity on that preview host. Notifications also require `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` to be configured in the web deployment.

## When the club domain is ready

Change `host`, `startUrl`, icon URLs and `webManifestUrl` in both TWA manifests to the club's production host, and point the field PWA manifest there. Add the signing certificate's SHA-256 fingerprint to `ANDROID_APP_SHA256_CERT_FINGERPRINTS` in the production deployment. The APK can keep the same package ID and signing key so admins can install updates over the preview build.

Do not commit keystores, signing passwords, `.aab` or `.apk` files.
