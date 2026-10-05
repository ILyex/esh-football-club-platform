# Contributing

## Before changing code

- Read `docs/architecture.md` and the relevant domain notes.
- Keep feature logic in the owning `src/lib` service or route group.
- Avoid editing `.env`, generated `.next` files or `.storage` content.
- Preserve existing database data; schema changes should be migrations.

## Code and UI

- Validate server input and authorize protected work on the server.
- Resolve team scope from current database assignments, not a URL, cookie or
  UI selection alone.
- Use shared components and translation messages for repeated UI patterns.
- Use the terminology in `docs/localization.md` and keep Arabic/French keys
  in sync.
- Use logical CSS properties so Arabic RTL and French LTR remain supported.
- Keep public content responsive, keyboard-accessible and respectful of
  reduced-motion preferences.

## Before merging

Run the locale parity check, type check, lint and the relevant unit tests. Run
integration tests only with a dedicated disposable database. For production
build changes, also run a production build and review its route and bundle
output.

The GitHub Actions workflow runs Prisma validation, locale parity, type check
and lint for pushes and pull requests. Keep changes focused, include a Prisma
migration for schema changes, and never commit environment files or data from
the local development environment.
