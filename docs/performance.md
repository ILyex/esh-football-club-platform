# Performance Notes

## Local development

The development command uses Turbopack. Next.js documents Turbopack as stable
for development and reports faster startup, route compilation and refresh on
many projects. Actual gains depend on the computer and application. The
project currently lives under OneDrive; file synchronization and indexing can
slow builds and hot reload. Keep an active checkout outside synchronized
folders when possible.

Do not run a production build and a development server against the same
checkout at the same time: both use the Next.js output directory.

## Public home page

The home page should request only fields and records it renders. Keep Prisma
projections explicit, cap lists, and avoid unbounded counts or duplicate
lookups. Public image lists should be small and newest-first. Interactive
carousels are user-controlled to avoid background state updates and reduce
motion for visitors who are reading.

Fonts use local system fallbacks so an external font service is not on the
initial render path. Below-the-fold photos should load lazily.

## Profiling a slow page

1. Record the route and whether the delay is server response, initial render,
   image loading or interaction.
2. Inspect the server terminal for route compilation and Prisma query time.
3. Check the browser Network panel for slow image requests and large client
   bundles.
4. Compare cold start with a second visit, then profile one suspected source
   at a time.
5. Keep before/after timings with the hardware, database and command used.

Do not add caching to private or permission-scoped data without defining its
invalidation and authorization behavior first.
