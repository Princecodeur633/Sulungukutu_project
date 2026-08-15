export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg-subtle)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-3 border-[var(--bd)] rounded-full" />
          <div className="absolute inset-0 border-3 border-t-indigo-600 rounded-full animate-spin" />
        </div>
        <p className="text-[var(--tx-muted)] text-sm font-medium">Chargement…</p>
      </div>
    </div>
  );
}
