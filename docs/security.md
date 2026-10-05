# Security Guidance

## Application controls

- Require a server-side permission check for every protected read or mutation.
- Enforce live team scope for team-owned data, including API routes.
- Keep private documents out of the public media bucket. Validate uploads by
  detected file type and size, and authorize each download by permission,
  classification and team scope.
- Keep audit records for security-sensitive changes and financial operations.
- Fail closed when the server cannot establish whether a session is valid.
- Treat an unknown or deleted role as having no team access; only a known,
  explicitly unscoped role or the reserved super-admin wildcard is unrestricted.
- Use parameterized Prisma queries and schema-validate all user input.

## Production configuration

- Provide strong, unique `AUTH_SECRET` and `CRON_SECRET` values.
- Require TLS for the database connection and private object storage.
- Keep the private storage bucket private and separate from public media.
- Configure trusted hostnames and HTTPS at the reverse proxy; do not expose
  internal services such as PostgreSQL or Ollama publicly.
- Never commit `.env`, `.env.local`, OAuth credentials, token-encryption keys,
  database dumps or private documents.
- Use least-privilege database and S3 credentials. Rotate any credential that
  may have been exposed.
- Login and search rate-limit counters use atomic PostgreSQL upserts, so limits
  are shared across Node.js processes. Apply the
  `20261006010000_distributed_rate_limit` migration before deploying this
  version. The account limit is independent of IP; configure the reverse proxy
  to strip client-supplied forwarding headers and set a trusted client-IP
  header before relying on the additional IP limit.
- Application audit rows are not tamper-evident by themselves. Restrict the
  application database role to SELECT/INSERT on the audit table where feasible,
  and export logs to separately controlled, append-only monitoring storage.
- The dashboard security panel evaluates only the audit events implemented in
  this application. It is a triage aid, not a SIEM, intrusion detector,
  session inventory, or certification that the platform is secure.

## Dependency review

Run `npm audit` when updating packages and review whether findings affect the
deployed runtime or only development tools. Do not apply `npm audit fix
--force` automatically: it may cross major versions of Next.js, Tailwind CSS
or next-intl. Check advisories and compatibility, then upgrade and verify the
app before deployment.

The project currently pins a local, compatible `braces` fork with a maximum
nested-brace depth of 100 to mitigate the upstream recursive-expansion denial
of service. Replace it with an upstream patched release when one becomes
available, then remove the local override and rerun the complete audit.

## Incident response

If an account or integration is suspected compromised, disable the account or
revoke the provider token, rotate its credentials, review audit logs, and
invalidate existing sessions by incrementing the user's token version. Restore
files and database records only from verified backups.
