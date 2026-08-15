'use client';
import React from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface Toast { id: string; type: ToastType; title: string; message?: string; }

interface ToastCtxValue {
  toasts: Toast[];
  success: (t: string, m?: string) => void;
  error:   (t: string, m?: string) => void;
  warning: (t: string, m?: string) => void;
  info:    (t: string, m?: string) => void;
  dismiss: (id: string) => void;
  addToast: (opts: { type: ToastType; title: string; message?: string }) => void;
}

const ToastContext = createContext<ToastCtxValue | null>(null);
export function useToast() {
  const c = useContext(ToastContext);
  if (!c) throw new Error('useToast must be inside ToastProvider');
  return c;
}

const CFG: Record<ToastType, {
  icon: React.ElementType;
  bg: string; border: string; iconColor: string; bar: string;
}> = {
  success: { icon: CheckCircle2,   bg: '#f0fdf4', border: '#bbf7d0', iconColor: '#059669', bar: '#059669' },
  error:   { icon: XCircle,        bg: '#fef2f2', border: '#fecaca', iconColor: '#dc2626', bar: '#dc2626' },
  warning: { icon: AlertTriangle,  bg: '#fffbeb', border: '#fde68a', iconColor: '#d97706', bar: '#d97706' },
  info:    { icon: Info,           bg: '#eff6ff', border: '#bfdbfe', iconColor: '#2563eb', bar: '#2563eb' },
};

// Dark mode overrides
const CFG_DARK: Record<ToastType, { bg: string; border: string }> = {
  success: { bg: 'rgba(5,150,105,.1)',   border: 'rgba(52,211,153,.2)'  },
  error:   { bg: 'rgba(220,38,38,.1)',   border: 'rgba(248,113,113,.2)' },
  warning: { bg: 'rgba(217,119,6,.1)',   border: 'rgba(251,191,36,.2)'  },
  info:    { bg: 'rgba(37,99,235,.1)',   border: 'rgba(96,165,250,.2)'  },
};

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  const cfg = CFG[toast.type];
  const { icon: Icon } = cfg;
  const [progress, setProgress] = useState(100);
  const [leaving, setLeaving] = useState(false);
  const DURATION = 5000;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / DURATION) * 100));
    }, 50);
    const timeout = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => dismiss(toast.id), 280);
    }, DURATION);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [toast.id, dismiss]);

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => dismiss(toast.id), 280);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 0,
      background: 'var(--bg-card)',
      border: `1px solid var(--bd)`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(26,24,37,.14), 0 2px 8px rgba(26,24,37,.08)',
      maxWidth: 380, width: '100%',
      pointerEvents: 'all',
      animation: leaving
        ? 'toast-out .28s cubic-bezier(.4,0,1,1) both'
        : 'toast-in .32s cubic-bezier(.34,1.56,.64,1) both',
    }}>
      {/* Contenu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 14px 12px' }}>
        {/* Icône */}
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cfg.bg, border: `1px solid ${cfg.border}`,
        }}>
          <Icon size={16} color={cfg.iconColor} />
        </div>
        {/* Texte */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          <p style={{
            fontSize: 13.5, fontWeight: 700,
            color: 'var(--tx-primary)', lineHeight: 1.3,
            fontFamily: "'Sora', sans-serif",
          }}>{toast.title}</p>
          {toast.message && (
            <p style={{
              fontSize: 12.5, color: 'var(--tx-muted)', marginTop: 3, lineHeight: 1.5,
            }}>{toast.message}</p>
          )}
        </div>
        {/* Bouton fermer */}
        <button onClick={handleDismiss} style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--tx-muted)', transition: 'all .15s',
        }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-subtle)';
            e.currentTarget.style.color = 'var(--tx-primary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--tx-muted)';
          }}
        ><X size={13} /></button>
      </div>

      {/* Barre de progression */}
      <div style={{ height: 3, background: 'var(--bd)', borderRadius: '0 0 14px 14px' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: cfg.bar, borderRadius: '0 0 14px 14px',
          transition: 'width .05s linear',
        }} />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p.slice(-4), { id, type, title, message }]);
  }, []);
  const dismiss = useCallback((id: string) => setToasts(p => p.filter(t => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{
      toasts,
      success: (t, m) => add('success', t, m),
      error:   (t, m) => add('error',   t, m),
      warning: (t, m) => add('warning', t, m),
      info:    (t, m) => add('info',    t, m),
      dismiss,
      addToast: ({ type, title, message }) => add(type, title, message),
    }}>
      {children}

      {/* Animations globales */}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-16px) scale(.95); }
          to   { opacity: 1; transform: translateY(0)     scale(1);   }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateY(0)    scale(1);   max-height: 120px; }
          to   { opacity: 0; transform: translateY(-12px) scale(.94); max-height: 0; }
        }
      `}</style>

      {/* Conteneur — centré en haut de l'écran, bien visible */}
      <div style={{
        position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => <ToastItem key={t.id} toast={t} dismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}
