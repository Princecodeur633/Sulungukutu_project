'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Sulungukutu] Error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg-subtle)] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-xl border border-[var(--bd)] p-10
                      text-center max-w-md w-full">
        <div className="w-16 h-16 bg-[var(--err-bg)] rounded-full flex items-center
                        justify-center mx-auto mb-4">
          <AlertTriangle size={32} className="text-[var(--err)]" />
        </div>

        <h1 className="text-xl font-bold text-[var(--tx-primary)] mb-2">Une erreur est survenue</h1>
        <p className="text-[var(--tx-muted)] text-sm mb-2">
          Un problème inattendu a été rencontré. Vous pouvez réessayer ou retourner à l'accueil.
        </p>

        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-xs font-mono text-[var(--err)] bg-[var(--err-bg)] border border-[var(--bd)]
                        rounded-lg px-3 py-2 mb-6 text-left break-all">
            {error.message}
          </p>
        )}

        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600
                       text-white font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <RefreshCw size={15} /> Réessayer
          </button>
          <a href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--bd)]
                       text-[var(--tx-secondary)] font-semibold text-sm hover:border-[var(--bd-strong)] transition-colors">
            <Home size={15} /> Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

