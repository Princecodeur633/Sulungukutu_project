'use client';

interface ProgressRingProps {
  /** Valeur entre 0 et 100 */
  percent: number;
  color?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  centerValue?: string;
}

/**
 * Jauge circulaire standard de la plateforme — remplace les pourcentages
 * affichés en texte brut sur les dashboards (moyenne générale, taux de
 * présence, taux de recouvrement des paiements...).
 */
export function ProgressRing({
  percent, color = '#4f46e5', size = 96, strokeWidth = 8, label, centerValue,
}: ProgressRingProps) {
  const clamped   = Math.max(0, Math.min(100, percent));
  const radius    = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset    = circumference - (clamped / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="var(--bg-subtle)" strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset .5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: size / 5, fontWeight: 700, color: 'var(--tx-primary)', fontFamily: "'Sora', sans-serif" }}>
            {centerValue ?? `${Math.round(clamped)}%`}
          </span>
        </div>
      </div>
      {label && <p style={{ fontSize: 12, color: 'var(--tx-muted)', fontWeight: 600 }}>{label}</p>}
    </div>
  );
}
