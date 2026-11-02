# AI and FAF integrations

## Local AI (Ollama)

The application calls Ollama from server-side code. Keep Ollama bound to the
local interface or a private trusted network; do not expose its port to the
public internet. AI is opt-in: `AI_ENABLED=false` (or an omitted flag) disables
inference while deterministic validation and fallback paths remain available. The model can assist with
wording, OCR, and extraction; it is not an authoritative source for identities,
financial records, match results, or document approval.

Configure the local endpoint, text model, vision model, and optional keep-alive
period in `.env`. For the full local document workflow, install both
`qwen2.5:7b` and `llava:7b` with Ollama. Scanned PDFs are rendered locally
with a 3-page OCR limit; PDFs over 20 pages require manual review. Health checks are bounded and never include prompts or document
contents. Identity images and relevant document text are sent to the configured
Ollama endpoint, so keep that endpoint private and trusted.

The browser assistant controls are opt-in as well. Keep
`NEXT_PUBLIC_AI_ENABLED=false` for cPanel production. To re-enable the
subsystem later, set both flags to `true`, provide a private Ollama endpoint,
and rebuild the application.

## FAF EMS

The match integration uses the same authenticated, read-only JSON and PDF routes
used by the club's EMS web application. It imports the Arabic first-match sheet
and final report from Historique into the private document store, and copies the
official score, referee, stadium, referee report, and match events into the
matching local fixture. It runs when a fixture is marked finished; users with
`matches.report` can also start it from the match documents panel.

Matching is restricted to the configured club FIFA ID, exact match date, and
opponent name. If no unique fixture matches, import stops without changing
records. Documents are private and marked for internal review. Imports are
idempotent per EMS match/document; credentials and cookies stay server-side,
and session cookies are encrypted in `IntegrationState` (using
`FAF_SESSION_ENCRYPTION_KEY` or the `AUTH_SECRET` fallback).

The EMS routes are application endpoints rather than a published developer
contract, so changes made by FAF to its web application may require an adapter
update. Keep the integration read-only on the EMS side and never expose club
credentials, session cookies, or downloaded documents in client logs.

### What happens to an imported document (sync → events → report)

A sync is not just "save the PDF". For each fixture the importer performs, in
this order:

1. **Fetch** the official match info plus the first sheet (`first-report-ar`)
   and final report (`final-report-ar`).
2. **Store** both documents privately and de-duplicate by exact bytes, so a
   re-sync does not create new versions.
3. **Read the sheet** to confirm the lineup (starters, substitutes, absences)
   and match the names against the squad.
4. **Read the final report** and, when the narrative heading is missing, keep a
   readable excerpt so the report field is never blank.
5. **Fill events immediately** with the deterministic parser (no network):
   goals, assists, yellow/red cards and substitutions, each only when the
   official text names the player and the minute. Unverifiable lines are
   discarded rather than guessed.
6. **Enrich in the background** with the AI pass (Cloudflare Workers AI on
   Vercel, Ollama locally). Substitutions are always re-checked by the
   deterministic parser because models tend to return only the incoming player.

Steps 5–6 exist because the AI job alone left the timeline empty whenever the
background worker was not running. The queue is still the source of truth: the
after-response processor runs the job immediately on serverless, and the
`/api/cron/process-jobs` schedule is the safety net.

### Background jobs on Vercel

`vercel.json` schedules two crons: the daily FAF import and a daily
`/api/cron/process-jobs` sweep. Vercel Cron calls the route with
`Authorization: Bearer $CRON_SECRET`, which is why the route accepts both `GET`
and `POST`. Raise the frequency of the sweep on a paid plan if queued work
(notifications, referee analysis) must be retried faster than daily.

### AI availability

`checkAIAvailability()` caches its probe for 60 seconds and `runAICompletion()`
retries once on a transient provider failure (`AI_UNAVAILABLE` / `AI_TIMEOUT`).
Quota exhaustion and a disabled provider are never retried. `/api/health?type=readiness`
reports `ai.configured` and `ai.provider` so an operator can tell whether the
document analysis has any chance of running before blaming the parser.
