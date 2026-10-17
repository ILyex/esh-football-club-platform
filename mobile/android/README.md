# ESH Matchday Android (TWA)

This Android package opens the club's protected field-match PWA in a Trusted Web Activity. The match UI and permissions stay on the platform; Android notification delivery uses the existing standards-based Web Push worker.

## Requirements before producing a distributable APK

- JDK 17 and Android SDK Platform 35 / Build Tools 35.
- A stable production hostname for `host`, `iconUrl`, and `webManifestUrl` in `twa-manifest.json`. The current values mirror the app's configured canonical host.
- A release signing key held outside the repository.
- `ANDROID_APP_SHA256_CERT_FINGERPRINTS` set on the web deployment to the SHA-256 certificate fingerprint used for the APK. The app serves the Digital Asset Links statement at `/.well-known/assetlinks.json`; without the matching fingerprint Chrome will show browser controls and the TWA is not fully verified.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` configured on the web deployment. Notifications remain disabled until all three are valid. The private key must never be put in this repository or the Android package.

## Build

Install Bubblewrap (`npm install --global @bubblewrap/cli`), run `bubblewrap init --manifest https://<production-host>/field/manifest.webmanifest`, and use the values in `twa-manifest.json` (package ID `dz.esh.footballclub.field`, start URL `/ar/field/matches`). Then run `bubblewrap build`. Keep the generated keystore and `android.keystore` out of git. The field route itself requires the signed-in account to have `matches.view`; server actions and API routes continue checking their own permissions.

This repository currently has no JDK or Android SDK installed, so an APK cannot be compiled in this workspace until those tools and the production signing setup are supplied.
