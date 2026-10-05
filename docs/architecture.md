# Architecture

## Runtime structure

The application is a Next.js App Router project. Routes are grouped by locale
(`ar` or `fr`) and then by public, authentication or dashboard experience.
Server Components own database reads and pass display-ready data to Client
Components where interaction is needed.

```text
Browser
  ├─ Public pages: /[locale]/...
  ├─ Dashboard pages: /[locale]/dashboard/...
  └─ Route handlers: /api/...
       ↓
Server Components / Server Actions / Route Handlers
  ├─ Auth.js session
  ├─ Permission and team-scope checks
  ├─ Domain services in src/lib
  └─ Prisma → PostgreSQL
       └─ Private and public storage adapters
```

## Boundaries

- **Routes** assemble a request or page and call domain services.
- **Server Actions** validate input, authorize the caller, perform mutations,
  write audit records and revalidate affected pages.
- **`src/lib/permissions.ts`** defines authentication and role permission
  checks. **`src/lib/mutation-guards.ts`** enforces live team assignments.
  A hidden UI control is never an authorization check.
- **`src/lib/public`** contains public read projections. Keep private keys,
  internal notes and unpublished records out of these projections.
- **`src/lib/finance`** owns financial invariants and ledger mutations. Use its
  services rather than writing treasury transactions from route code.
- **`src/lib/storage.ts`** separates public assets from private documents.
- **`prisma/schema.prisma`** is the current data model; `prisma/migrations`
  records database changes in deployment order.

## Authentication and authorization

Auth.js uses credentials and JWT sessions. The server checks account status
and token version; permission keys are attached to the session. Team scope is
resolved from current database assignments and is separate from the role
permission decision. Sensitive document downloads also check classification
and team ownership before issuing a short-lived URL.

## Localization

The locale layout sets the document `lang` and `dir`. Arabic is RTL; French is
LTR. Shared layouts should use logical CSS properties (`ms-*`, `me-*`, `start-*`,
`text-start`) so one component works in both directions. Message files must
have matching key trees; `npm run i18n:check` checks this contract.

## Data changes

Prefer additive, reversible Prisma migrations. Back up production data before
applying a migration that drops or rewrites data. Deploy migrations before
code that requires new columns or tables. Do not edit applied migration files.
