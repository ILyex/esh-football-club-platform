# Finance & Treasury verification suite

Two layers, deliberately kept separate so nobody mistakes one for the other.

## 1. `unit/` — no database, runs anywhere (`npm run test:finance`)

Real application code (treasury service, server actions, resolvers, download route, zod schemas, insight rules)
running against **test doubles** in `mocks/`: an in-memory database, an in-memory object store, a stand-in template
renderer, and a mocked session. It verifies **logic and data flow**, including "the audit write uses the
transaction client" (the fake fails any call made on the root client inside a transaction).

What it does **not** prove: PostgreSQL isolation behaviour (the fake serialises transactions with a mutex),
Prisma query semantics, or docxtemplater rendering. Those are layer 2.

`static-invariants.test.ts` and `i18n.test.ts` read the repository itself (schema, source, catalogs) and need no mocks.

## 2. `integration/` — real PostgreSQL + real docxtemplater (`npm run test:finance:integration`)

```bash
createdb football_club_test
export DATABASE_URL_TEST="postgresql://user:pass@localhost:5432/football_club_test"
DATABASE_URL="$DATABASE_URL_TEST" npx prisma db push
npm run test:finance:integration
```

* **Destructive**: it TRUNCATEs every table. It refuses to run unless the database name contains `test`; without
  `DATABASE_URL_TEST` the whole suite is reported as *skipped*, never as passed.
* Real: Prisma client, PostgreSQL SERIALIZABLE transactions, unique constraints, treasury service, actions, audit
  writer, permissions, zod, `docxtemplater` + `pizzip`.
* Replaced: the session (`@/lib/auth`), private object storage (in-memory), `next/navigation|cache|headers`.
* Covers: no negative balance; concurrent withdrawals / deposit+withdrawal; idempotent replay, conflicts and
  concurrent same-key submissions; duplicate expense payment; amount/status/inactive-account rules; reversal,
  double/concurrent reversal, reversal-of-reversal, original-row immutability; audit atomicity (a trigger makes the
  audit insert fail and every mutation must roll back); expense↔budget consistency under concurrency; and all three
  financial documents end to end (values from the DB, hostile form values ignored, layout parts byte-identical to
  the template, stored template untouched, no `{{` left, GeneratedDocument + entity link + audit, download
  authorization).

`fixtures/official-template.docx` is an official-style template (header with logo, footer, bordered table,
placeholders as `{{NAME}}`), generated with python-docx.
