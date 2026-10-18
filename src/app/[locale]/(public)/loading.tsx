export default function PublicLoading() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-7xl animate-pulse space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <span className="sr-only">Loading</span>
      <div className="h-56 rounded-3xl border border-border/70 bg-card sm:h-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-44 rounded-2xl border border-border/70 bg-card" />
        ))}
      </div>
    </div>
  );
}
