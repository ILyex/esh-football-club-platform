# Operations Notes

## Document generation

Document generation produces `.docx` files using the uploaded templates and
field mappings. The download route can return a PDF when `PDF_CONVERTER_URL`
points to a compatible converter (for example, a private Gotenberg service).
Without that setting, the route returns a clear unavailable response; it does
not rename a DOCX file to pretend it is a PDF. The browser's print dialog is
also available for previews.

Keep the converter on a private network, validate the configured endpoint, and
do not expose it directly to untrusted callers. Follow the environment
template for configuration.

## Backups & recovery — infrastructure requirement, not application code

This app stores state in three places that all need their own backup
strategy; none of this is configured by the application itself, and no code
in this repo currently performs backups:

1. **PostgreSQL** — use your hosting provider's point-in-time recovery /
   automated snapshots (Neon, Supabase, RDS, etc. all offer this natively),
   or `pg_dump` on a schedule if self-hosting. Test restores periodically —
   an untested backup is not a backup.
2. **Private document bucket** (`STORAGE_PRIVATE_BUCKET`) — contracts,
   restricted documents, generated official documents. Enable versioning
   and cross-region replication at the bucket level (S3/R2 support this
   natively); this is a bucket configuration, not application code.
3. **Public media bucket** (`STORAGE_PUBLIC_BUCKET`) — lower priority (news
   images, gallery photos) but still worth the same bucket-level versioning.

Recovery drill checklist before going to production: restore a DB snapshot
to a scratch instance, confirm a private-bucket object is still fetchable
after a simulated bucket-versioning rollback, and confirm the app boots
against the restored DB without manual data patching.

## Finance & Treasury

- **Schema**: notification enum and finance schema changes are versioned in
  `prisma/migrations`. Apply them in order with `npm run db:migrate:deploy`
  before deploying application code. Reserve `npm run db:push` for disposable
  local databases only.
- **Ledger integrity**: `src/lib/finance/treasury-service.ts` is the only
  writer of `TreasuryTransaction`. It relies on PostgreSQL `SERIALIZABLE`
  transactions plus the unique constraints on `idempotencyKey`,
  `relatedExpenseId` and `reversalOfTransactionId`; do not run it against a
  database that downgrades isolation levels. Never edit or delete ledger rows
  by hand — corrections are new (reversal) entries. Data Quality Center shows
  a critical finding if a derived balance ever goes negative or an expense and
  its payment disagree.
- **Official financial documents**: upload one `.docx` template per type
  (`EXPENSE_STATEMENT`, `DEPOSIT_RECEIPT`, `WITHDRAWAL_RECEIPT`) in Document
  Templates, map placeholders to the database paths offered in the mapping
  screen, then activate. Generating them needs `documents.generate` **and**
  `finance.approve`; reading them needs `documents.generate` and `finance.view`.
  Only POSTED expenses and non-reversed, non-reversal ledger entries can be
  issued as documents. AI assistance is disabled for these types.
- **Notifications** are still generated best-effort on dashboard load (see
  above); a scheduled job is the recommended production trigger. Each
  notification stores its insight params, and the notifications page renders
  the text in the viewer's own language (Arabic/French); `title` is only the
  fallback for rows created before the `params` column existed.
- **Audit atomicity**: every finance mutation (ledger movements, account/budget
  /expense create-update-post-cancel, document generation) writes its audit row
  in the same database transaction; if the audit insert fails the mutation is
  rolled back. Object storage cannot join a database transaction, so a generated
  file is uploaded first and deleted again if the database part fails.
- **Idempotency**: reusing an idempotency key for a *different* request is an
  explicit `IDEMPOTENCY_CONFLICT`; only an identical request replays the stored
  transaction. Keys starting with `reversal-` are reserved.
- **Budgets**: lowering an allocation below what is already posted is allowed
  (overspend is a reported state, not a blocked one — red "remaining", an
  explicit notice, the `BUDGET_EXCEEDED` insight). Season/team of a budget cannot
  change once expenses are linked.
- **Documents are DOCX only.** No PDF is produced anywhere (see the section above).
- **Verification**: `npm run test:finance` (no database) and
  `npm run test:finance:integration` (real PostgreSQL, see `tests/finance/README.md`).
