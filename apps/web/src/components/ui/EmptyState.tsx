import React from 'react';
import {
  EmptyStateIllustration,
} from '@/components/illustrations/Illustrations';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  illustration?: React.ReactNode;
  compact?: boolean;
}

/**
 * Bloc d'état vide réutilisable, avec illustration vectorielle,
 * pour remplacer les messages texte bruts dans les tableaux/listes.
 */
export function EmptyState({ title, subtitle, action, illustration, compact = false }: EmptyStateProps) {
  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: compact ? '28px 20px' : '48px 24px',
        gap: 6,
      }}
    >
      <div style={{ width: compact ? 120 : 180, marginBottom: 12, color: 'var(--tx-muted)' }}>
        {illustration ?? <EmptyStateIllustration style={{ width: '100%', height: 'auto' }} />}
      </div>
      <h3 style={{ fontSize: compact ? 14 : 16, fontWeight: 700, color: 'var(--tx-primary)' }}>{title}</h3>
      {subtitle && (
        <p style={{ fontSize: 13, color: 'var(--tx-muted)', maxWidth: 340 }}>{subtitle}</p>
      )}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
