import React from 'react';

type IllustrationProps = {
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Illustration héroïque pour le panneau de branding de la page de connexion.
 * Scène : poste de travail avec ordinateur, notifications et diplôme flottants.
 */
export function LoginIllustration({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 480 400" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="loginGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>

      <ellipse cx="240" cy="210" rx="210" ry="170" fill="#ffffff" opacity="0.05" />

      {/* bureau */}
      <rect x="70" y="290" width="340" height="14" rx="7" fill="#ffffff" opacity="0.12" />
      <rect x="95" y="304" width="14" height="55" fill="#ffffff" opacity="0.1" />
      <rect x="371" y="304" width="14" height="55" fill="#ffffff" opacity="0.1" />

      {/* ordinateur portable */}
      <g>
        <rect x="165" y="230" width="150" height="96" rx="8" fill="#ffffff" opacity="0.14" />
        <rect x="176" y="241" width="128" height="74" rx="4" fill="url(#loginGrad)" />
        <rect x="150" y="326" width="180" height="10" rx="5" fill="#ffffff" opacity="0.2" />
        <polyline points="188,296 210,270 232,282 254,254 276,262 292,248" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        <circle cx="292" cy="248" r="4" fill="#ffffff" />
      </g>

      {/* carte flottante : validation */}
      <g transform="translate(320,150)">
        <rect x="0" y="0" width="86" height="64" rx="14" fill="#ffffff" opacity="0.95" />
        <circle cx="28" cy="32" r="16" fill="#22c55e" opacity="0.15" />
        <path d="M20 32 L26 38 L38 24" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="52" y="22" width="24" height="6" rx="3" fill="#e2e8f0" />
        <rect x="52" y="34" width="18" height="6" rx="3" fill="#e2e8f0" />
      </g>

      {/* carte flottante : notification */}
      <g transform="translate(56,110)">
        <rect x="0" y="0" width="78" height="60" rx="14" fill="#ffffff" opacity="0.95" />
        <circle cx="26" cy="30" r="15" fill="#f59e0b" opacity="0.18" />
        <path d="M26 21 a8 8 0 0 1 8 8 v4 l3 4 h-22 l3 -4 v-4 a8 8 0 0 1 8 -8 z" fill="#f59e0b" />
        <circle cx="26" cy="39" r="2.4" fill="#f59e0b" />
        <rect x="48" y="20" width="20" height="6" rx="3" fill="#e2e8f0" />
        <rect x="48" y="32" width="14" height="6" rx="3" fill="#e2e8f0" />
      </g>

      {/* toque de graduation */}
      <g transform="translate(220,60)">
        <path d="M40 0 L80 16 L40 32 L0 16 Z" fill="#f59e0b" />
        <path d="M20 22 v14 c0 6 9 10 20 10 s20 -4 20 -10 v-14 l-20 8 z" fill="#fbbf24" />
        <line x1="74" y1="16" x2="74" y2="36" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <circle cx="74" cy="39" r="3" fill="#f59e0b" />
      </g>

      <circle cx="60" cy="60" r="4" fill="#ffffff" opacity="0.25" />
      <circle cx="420" cy="90" r="5" fill="#ffffff" opacity="0.2" />
      <circle cx="430" cy="260" r="4" fill="#ffffff" opacity="0.2" />
      <circle cx="40" cy="230" r="3.5" fill="#ffffff" opacity="0.25" />
    </svg>
  );
}

/** Illustration générique pour les listes/tableaux vides. */
export function EmptyStateIllustration({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 400 320" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="200" cy="270" rx="120" ry="14" fill="currentColor" opacity="0.06" />
      <g>
        <path d="M90 150 L200 110 L310 150 L310 230 L200 260 L90 230 Z" fill="#e0e7ff" />
        <path d="M90 150 L200 180 L310 150" fill="none" stroke="#c7d2fe" strokeWidth="3" />
        <path d="M200 180 L200 260" stroke="#c7d2fe" strokeWidth="3" />
        <path d="M90 150 L200 110 L310 150 L200 180 Z" fill="#eef2ff" />
        <path d="M130 128 L200 110 L200 145 L145 160 Z" fill="#c7d2fe" opacity="0.7" />
        <path d="M270 128 L200 110 L200 145 L255 160 Z" fill="#c7d2fe" opacity="0.7" />
      </g>
      <g transform="translate(178,55)">
        <circle cx="22" cy="22" r="22" fill="#818cf8" opacity="0.15" />
        <text x="22" y="31" fontSize="26" fontWeight="700" fill="#6366f1" textAnchor="middle" fontFamily="Arial, sans-serif">?</text>
      </g>
      <circle cx="70" cy="90" r="5" fill="#c7d2fe" />
      <circle cx="335" cy="110" r="4" fill="#c7d2fe" />
      <circle cx="320" cy="220" r="3.5" fill="#c7d2fe" />
    </svg>
  );
}

/** Illustration pour la page 404. */
export function NotFoundIllustration({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 460 340" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="230" cy="300" rx="140" ry="14" fill="currentColor" opacity="0.05" />
      <text x="230" y="200" fontSize="150" fontWeight="900" fill="currentColor" opacity="0.07" textAnchor="middle" fontFamily="Arial, sans-serif">404</text>
      <g transform="translate(170,110)">
        <circle cx="60" cy="60" r="58" fill="#ffffff" stroke="#c7d2fe" strokeWidth="6" />
        <circle cx="60" cy="60" r="42" fill="#eef2ff" />
        <polygon points="60,26 70,60 60,94 50,60" fill="#f59e0b" transform="rotate(35 60 60)" />
        <circle cx="60" cy="60" r="6" fill="#4f46e5" />
        <text x="60" y="18" fontSize="10" fill="#8b8797" textAnchor="middle" fontFamily="Arial, sans-serif">N</text>
        <text x="60" y="112" fontSize="10" fill="#8b8797" textAnchor="middle" fontFamily="Arial, sans-serif">S</text>
      </g>
      <circle cx="90" cy="80" r="4" fill="#c7d2fe" />
      <circle cx="380" cy="100" r="5" fill="#c7d2fe" />
      <circle cx="360" cy="240" r="4" fill="#c7d2fe" />
      <circle cx="80" cy="230" r="3.5" fill="#c7d2fe" />
    </svg>
  );
}

/** Illustration de bienvenue (établissement / onboarding). */
export function WelcomeIllustration({ className, style }: IllustrationProps) {
  return (
    <svg viewBox="0 0 440 340" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="220" cy="300" rx="150" ry="14" fill="currentColor" opacity="0.05" />
      <g>
        <rect x="120" y="120" width="200" height="150" rx="6" fill="#eef2ff" />
        <polygon points="120,120 220,70 320,120" fill="#4f46e5" />
        <rect x="205" y="80" width="30" height="30" fill="#4f46e5" />
        <circle cx="220" cy="60" r="6" fill="#f59e0b" />
        <rect x="196" y="210" width="48" height="60" rx="4" fill="#c7d2fe" />
        <rect x="140" y="150" width="30" height="30" rx="4" fill="#ffffff" stroke="#c7d2fe" strokeWidth="3" />
        <rect x="270" y="150" width="30" height="30" rx="4" fill="#ffffff" stroke="#c7d2fe" strokeWidth="3" />
        <rect x="140" y="195" width="30" height="30" rx="4" fill="#ffffff" stroke="#c7d2fe" strokeWidth="3" />
        <rect x="270" y="195" width="30" height="30" rx="4" fill="#ffffff" stroke="#c7d2fe" strokeWidth="3" />
      </g>
      <line x1="320" y1="120" x2="320" y2="70" stroke="#8b8797" strokeWidth="3" />
      <polygon points="320,70 350,80 320,90" fill="#f59e0b" />
      <circle cx="70" cy="90" r="5" fill="#f59e0b" />
      <rect x="360" y="100" width="9" height="9" fill="#22c55e" transform="rotate(20 364 104)" />
      <circle cx="380" cy="180" r="4" fill="#6366f1" />
      <rect x="60" y="200" width="8" height="8" fill="#ef4444" transform="rotate(-15 64 204)" />
      <circle cx="350" cy="230" r="4.5" fill="#22c55e" />
    </svg>
  );
}
