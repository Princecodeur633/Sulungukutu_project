'use client';
import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';
import { NotFoundIllustration } from '@/components/illustrations/Illustrations';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="animate-scale-in" style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ width: 260, maxWidth: '100%', margin: '0 auto 8px', color: 'var(--tx-muted)' }}>
          <NotFoundIllustration style={{ width: '100%', height: 'auto' }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-primary)', marginBottom: 8 }}>Page introuvable</h1>
        <p style={{ color: 'var(--tx-muted)', marginBottom: 32, fontSize: 14 }}>
          Cette page n'existe pas ou vous n'avez pas les droits pour y accéder.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Link href="/" className="btn-primary">
            <Home size={15} /> Accueil
          </Link>
          <button onClick={() => window.history.back()} className="btn-secondary">
            <ArrowLeft size={15} /> Retour
          </button>
        </div>
      </div>
    </div>
  );
}
