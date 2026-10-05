# Espoir Sidi Hosni Platform

Web platform for Espoir Sidi Hosni (ESH), a football club in Sidi Hosni,
Tiaret. It combines the public club website with a role- and team-scoped
management dashboard.

## Stack

- Next.js App Router, React, TypeScript and Tailwind CSS
- PostgreSQL with Prisma
- Auth.js credentials authentication and database-driven RBAC
- Arabic and French localization with RTL/LTR layouts
- Private S3-compatible storage for documents; separate public media storage
- Background jobs, club mail integration, finance and treasury workflows

## Start locally

Requirements: Node.js 20.9 or newer, npm, and PostgreSQL. If `.env` does not
exist, copy `.env.example` to `.env`; set at least `DATABASE_URL` and
`AUTH_SECRET` before starting the application.

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run dev
```

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
npm run dev                  # Local development with Turbopack
npm run build                # Production build
npm run start                # Serve a production build
npm run lint                 # ESLint
npm run typecheck            # TypeScript check
npm run i18n:check           # Arabic/French message key parity
npm run test:finance         # Finance unit tests
npm run test:rbac            # RBAC unit tests
npm run test:testing         # Player testing unit tests
npm run test:all             # All configured unit suites
```

See [development setup](docs/development.md), [architecture](docs/architecture.md),
[security](docs/security.md), [operations](OPERATIONS.md), and the
[Arabic/French glossary](docs/localization.md).
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

- Local development uses filesystem media storage when S3 is not configured.
- Server-side DOCX-to-PDF conversion requires a configured converter service.
- External OAuth, mail, FAF and AI features need their own credentials and
  infrastructure; unset optional integrations remain unavailable.
- The release process requires applying Prisma migrations before deploying
  application code that depends on them.
