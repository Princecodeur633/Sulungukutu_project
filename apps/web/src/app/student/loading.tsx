export default function RoleLoading() {
  return (
    <div className="space-y-4 animate-pulse p-1">
      {/* Header skeleton */}
      <div className="h-8 bg-slate-200 rounded-xl w-48" />
      <div className="h-4 bg-[var(--bg-subtle)] rounded-lg w-72" />
      {/* Cards skeleton */}
      <div className="grid grid-cols-4 gap-3 mt-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-24 bg-[var(--bg-subtle)] rounded-2xl" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-2 gap-5 mt-2">
        <div className="h-64 bg-[var(--bg-subtle)] rounded-2xl" />
        <div className="h-64 bg-[var(--bg-subtle)] rounded-2xl" />
      </div>
    </div>
  );
}
