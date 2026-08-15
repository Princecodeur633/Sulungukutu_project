'use client';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  /** Une des couleurs de lib/chartColors.ts (chartColors.accent, .amber, .emerald, .sky, .rose) */
  color: string;
  value: string | number;
  label: string;
  /** Variation en % (positif = vert, négatif = rouge) — optionnel */
  trend?: number;
  onClick?: () => void;
}

/**
 * Carte KPI standard de la plateforme. Remplace les cartes bricolées
 * différemment sur chaque dashboard (admin/teacher/parent/student) — un
 * seul composant, un seul style, une couleur toujours issue de la palette
 * partagée (jamais de hex en dur au niveau de l'appelant).
 */
export function StatCard({ icon: Icon, color, value, label, trend, onClick }: StatCardProps) {
  return (
    <div
      className={onClick ? 'card-hover' : 'card-flat'}
      onClick={onClick}
      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}1a`, // ~10% opacité, cohérent quel que soit le hex
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon size={17} style={{ color }} />
      </div>

      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-primary)', fontFamily: "'Sora', sans-serif", letterSpacing: '-0.02em' }}>
          {value}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <p style={{ fontSize: 12, color: 'var(--tx-muted)' }}>{label}</p>
          {trend !== undefined && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600,
              color: trend >= 0 ? 'var(--ok)' : 'var(--err)',
            }}>
              {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
