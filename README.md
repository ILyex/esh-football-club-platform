# Espoir Sidi Hosni Platform

## Native matchday Android app

The standalone Android app is in `mobile/android/native`. It uses Jetpack
Compose and talks to the platform API directly; it does not embed the website
in a WebView or open a browser. It uses the platform's Cairo font and red,
charcoal, and mint palette, with Arabic RTL and French LTR layouts. It includes
administrator login, meetings, matchday score/event controls, training-session
creation, and bilingual news/announcement publishing to the shared platform
database and public site. Its package ID is `dz.esh.footballclub.field`.

Build the signed preview APK on the configured Windows workstation:

```powershell
.\mobile\android\build-native-preview.ps1
```

The resulting file is
`mobile/android/native/app-release-native-signed.apk`. The app currently uses
the preview API host `https://esh-platform-vercel-preview.vercel.app`; update
`BASE_URL` in `mobile/android/native/app/src/main/java/dz/esh/footballclub/field/NativeApi.kt`
when the club has its final domain.

### Publish native Android updates

The updater reads `public/native-android-release.json` and downloads the signed
APK from `public/downloads/esh-field-latest.apk`. The signed build script writes
both files and records the APK's SHA-256 digest. Increase `versionCode` and
`versionName` in `mobile/android/native/app/build.gradle`, run
`mobile/android/build-native-preview.ps1`, then deploy the website to its public
host. Keep the same signing key for every release: Android can install an update
over the existing app without deleting it, but Android still asks the user to
confirm installation. The updater verifies the APK digest before opening that
installer.

### Activate native phone notifications

The app can display Android system notifications, but delivery from the
platform requires a Firebase project. Register an Android app in Firebase
with package ID `dz.esh.footballclub.field`, download `google-services.json`,
and put it at `mobile/android/native/app/google-services.json`. Add the Firebase
service-account JSON to the Vercel Preview environment as the secret
`FIREBASE_SERVICE_ACCOUNT_JSON` and grant it Firebase Cloud Messaging send
permission. Do not commit either credential. Then redeploy the platform and
rebuild the APK. Android 13 and newer will ask the administrator to allow
notifications after sign-in.

Apply the additive database migration to the Vercel database before deploying
the API changes, using the project's configured production migration process
(`npm run db:migrate:deploy`). It adds revocable native sessions and linked
push-device records. Without this migration, native login/device registration
cannot persist. Without the Firebase configuration, the APK remains usable
but cannot receive remote meeting notifications.

The release build uses the existing private workstation signing key. Keep that
key backed up: future APK updates must use the same key to install over this
release. The old TWA project is retained separately and is not used by this
native app.

---

Web platform for Espoir Sidi Hosni (ESH), a football club in Sidi Hosni,
Tiaret. It combines the public club website with a role- and team-scoped
management dashboard.

## Stack

- Next.js App Router, React, TypeScript and Tailwind CSS
- PostgreSQL with Prisma
- Auth.js credentials authentication and database-driven RBAC
- Arabic and French localization with RTL/LTR layouts
- Private document storage and public media, using separate S3 buckets or explicitly configured persistent local storage on a single server
- Background jobs, club mail integration, finance and treasury workflows

## Start locally

Requirements: Node.js 22.12 or newer, npm, and PostgreSQL. If `.env` does not
exist, copy `.env.example` to `.env`; set at least `DATABASE_URL` and
`AUTH_SECRET` before starting the application.

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run dev
```

`npm run dev` is for software development and compiles routes as they are
visited, so its memory use grows during the first navigation through the app.
For daily club administration on a low-spec PC, prepare the standalone
production package once with `npm run build:cpanel`, then use the
`Launch-ESH-Platform.vbs` shortcut. It starts the compiled Node server without
the development compiler or file watchers. Use `npm run start` only after a
production build is already present.

Open `http://localhost:3000/ar` for Arabic or `http://localhost:3000/fr` for
French. For a disposable local database, see [development setup](docs/development.md).
Never use demo seed data on a production database.

## Project map

| Path | Purpose |
|---|---|
| `src/app/[locale]/(public)` | Public website pages |
| `src/app/[locale]/(dashboard)` | Authenticated management pages and server actions |
| `src/app/api` | Route handlers and integrations |
| `src/components` | Shared and feature-specific UI |
| `src/lib` | Authentication, authorization, data access and domain services |
| `src/i18n` | Locale routing and Arabic/French messages |
| `prisma` | Database schema and versioned migrations |
| `scripts` | Maintenance, verification and operational scripts |
| `tests` | Unit and integration tests grouped by domain |
| `docs` | Architecture, local setup, security, operations and domain guidance |
| `.github/workflows` | Automated repository quality checks |

## Main areas

- Public club site: teams, players, fixtures, results, competitions, news and
  gallery
- Club operations: players, staff, training, testing, inventory and insurance
- Administration: users, roles, team assignments, documents and audit history
- Finance: budgets, expenses, treasury transactions and official document
  generation
- Integrations: scheduled jobs, official Gmail, local AI and FAF portal access
  (automated data import requires an authorized API or export contract)

## Common commands

```powershell
npm run dev                  # Development only; Webpack compiles routes on demand
npm run build:cpanel         # Prepare optimized standalone production runtime
npm run build                # Production build
npm run start                # Serve an existing production build
npm run lint                 # ESLint (flat config)
npm run typecheck            # TypeScript check
npm run i18n:check           # Arabic/French message key parity
npm run test:finance         # Finance unit tests
npm run test:rbac            # RBAC unit tests
npm run test:testing         # Player testing unit tests
npm run test:root            # Storage/schema/attendance/label/conductor tests
npm run test:security:audit  # Production dependency gate
npm run test:all             # Every suite above, in CI order
```

Official documents are rendered as real A4 sheets; see
[documents and printing](docs/documents-and-printing-ar.md) before changing any
print style.

See [development setup](docs/development.md), [architecture](docs/architecture.md),
[security](docs/security.md), [operations](OPERATIONS.md), and the
[Arabic/French glossary](docs/localization.md).
For the PHP/MySQL shared-hosting migration, see
[the compatibility plan](docs/php-mysql-migration-ar.md).
For cPanel deployment constraints and setup, see [the cPanel deployment guide](docs/cpanel-deployment-ar.md).
Before purchasing hosting or publishing, follow the [Arabic production-readiness guide](docs/production-readiness-ar.md).
See [AI and FAF integration status](docs/integrations.md) before configuring
local inference or attempting federation synchronization.

## Preparing a GitHub release

The repository includes a lockfile, environment template, database migrations,
developer documentation and a GitHub quality workflow. Before publishing,
review the deployment checklist and choose the repository visibility and license
with the club's authorized owner. No license has been assigned in this
repository; public visibility alone does not grant reuse rights.

For a new GitHub repository, create an empty repository on GitHub, then run
these commands from the project root after reviewing the staged file list:

```powershell
git add .
git status --short
git diff --cached --stat
git commit -m "Prepare ESH platform repository"
git remote add origin <GITHUB_REPOSITORY_URL>
git push -u origin main
```

The local repository is initialized on `main`; `.env`, `.env.local`, generated
build files, uploads and `scratch/` are ignored. Do not force-add ignored local
files to make the upload succeed.

## Configuration and security

`.env.example` documents recognized configuration. Keep `.env`, `.env.local`,
credentials and production data out of source control. Production needs a
strong `AUTH_SECRET`, `CRON_SECRET`, PostgreSQL, and private document storage.
Public media must use a different bucket from confidential documents.

The dashboard checks authentication, permissions and team scope on the server.
Documents are private by default and must pass classification and team checks
before a download link is issued. Review [security guidance](docs/security.md)
before deploying.

## Current limits

- Local development uses filesystem media storage when S3 is not configured; production can explicitly use a persistent local path on a single server, with that path included in backups.
- Server-side DOCX-to-PDF conversion requires a configured converter service.
- External OAuth, mail, FAF and AI features need their own credentials and
  infrastructure; unset optional integrations remain unavailable.
- The release process requires applying Prisma migrations before deploying
  application code that depends on them.
