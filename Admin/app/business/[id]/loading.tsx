export default function BusinessLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
      <div className="h-52 animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  );
}
