# ESH Public Supporters App

This is a separate native Android app for supporters. It has its own Gradle
project, app ID (`dz.esh.footballclub.publicapp`), preferences, notification
inbox, and FCM registration table. It can be installed beside the administrator
app without sharing its login or local data.

## Features

- Arabic RTL and French LTR interfaces, with an in-app language switch.
- Public club home feed, announcements, upcoming matches, scores, training,
  published news, social reels, photo albums, and video playback.
- Match center with public events, starting lineup, and substitutes.
- Live match alerts through FCM. The service stores alerts in this app's local
  inbox and never reads the administrator app's notification preferences.
- Public content is read from the same published-data rules used by the site.

## Build

Run `mobile/android/build-public-app.ps1` on the configured Windows build
workstation. The signed APK is written to
`mobile/android/public/app-release-public-signed.apk`.

## Live notifications setup

The administrator app's `google-services.json` is registered to a different
Android package and must not be copied here. Register
`dz.esh.footballclub.publicapp` as a separate Android app in the existing
Firebase project, then place its `google-services.json` at
`mobile/android/public/app/google-services.json`. The server already sends
FCM with `FIREBASE_SERVICE_ACCOUNT_JSON`; deploy the public-device migration
and API with the platform for live-match notification delivery.

The API surface is `/api/public/mobile`, with public detail routes under
`/api/public/mobile/{matches,news,gallery}` and device registration under
`/api/public/mobile/devices`.
