export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="space-y-5 animate-pulse"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-48 rounded-lg bg-muted" />
        <div className="h-9 w-28 rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-border bg-card" />
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-border bg-card" />
    </div>
  );
}
