# AI and FAF integrations

## Local AI (Ollama)

The application calls Ollama from server-side code. Keep Ollama bound to the
local interface or a private trusted network; do not expose its port to the
public internet. AI is opt-in: `AI_ENABLED=false` (or an omitted flag) disables
inference while deterministic validation and fallback paths remain available. The model can assist with
wording, OCR, and extraction; it is not an authoritative source for identities,
financial records, match results, or document approval.

Configure the local endpoint, text model and vision model in `.env`. Scanned
PDFs are rendered locally with a 3-page OCR limit; PDFs over 20 pages require
manual review. Install the configured Ollama models before expecting image OCR
to work. Health checks are bounded and never include prompts or document
contents. Identity images and relevant document text are sent to the configured
Ollama endpoint, so keep that endpoint private and trusted.

The browser assistant controls are opt-in as well. Keep
`NEXT_PUBLIC_AI_ENABLED=false` for cPanel production. To re-enable the
subsystem later, set both flags to `true`, provide a private Ollama endpoint,
and rebuild the application.

## FAF Connect

The authenticated FAF Connect and EMS websites are available as human-operated
portals. This codebase does not have a verified, authorized FAF data API
contract. The former player, staff, and fixture methods returned empty arrays,
and match-document synchronization could fabricate official-looking sheets
from local/demo values. Those paths now fail explicitly; the match-document
operation records a blocked attempt in the audit log and makes no match or
document changes.

Do not enable automatic import until the club has the federation's written
integration contract or an official export format. Implement the approved
adapter against that contract, validate all external records, preserve local
field authority rules, retain source/provenance and sync timestamps, and audit
created/updated/conflicting records. Never infer that a reachable login page
means data synchronization works.

Store portal secrets only in the server environment. Set a separate random
`FAF_SESSION_ENCRYPTION_KEY` of at least 32 characters to encrypt the persisted
session cookie; `AUTH_SECRET` is accepted as a fallback. Do not expose either
secret to browser code, client logs, or support screenshots.
