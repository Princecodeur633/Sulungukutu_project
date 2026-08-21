'use client';

import React, { useEffect, useState } from 'react';
import { X, Copy, Check, KeyRound } from 'lucide-react';

export function FormField({
  label, required, hint, error, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span style={{ color: 'var(--err)', marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {error
        ? <p style={{ fontSize: 11.5, color: 'var(--err)', marginTop: 5, lineHeight: 1.4 }}>{error}</p>
        : hint
          ? <p style={{ fontSize: 11.5, color: 'var(--tx-muted)', marginTop: 5, lineHeight: 1.45 }}>{hint}</p>
          : null}
    </div>
  );
}

export function FormSection({
  icon, title, children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{
      background: 'var(--bg-subtle)', border: '1px solid var(--bd)',
      borderRadius: 14, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {icon}
        <h3 style={{
          fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em',
          textTransform: 'uppercase', color: 'var(--tx-secondary)',
        }}>
          {title}
        </h3>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </section>
  );
}

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

export function ChoiceChip({
  selected, onClick, children, compact,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: compact ? '8px 10px' : '10px 12px',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: compact ? 12.5 : 13,
        fontWeight: 600,
        border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--bd)'}`,
        background: selected ? 'var(--accent-light)' : 'var(--bg-card)',
        color: selected ? 'var(--accent)' : 'var(--tx-primary)',
      }}
    >
      {children}
    </button>
  );
}

export function FormActions({
  hint, cancelLabel = 'Annuler', submitLabel, loading, onCancel, disabled,
}: {
  hint?: string;
  cancelLabel?: string;
  submitLabel: string;
  loading?: boolean;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{
      padding: '14px 22px', borderTop: '1px solid var(--bd)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap', flexShrink: 0, background: 'var(--bg-card)',
    }}>
      {hint
        ? <p style={{ fontSize: 11.5, color: 'var(--tx-muted)', lineHeight: 1.4, maxWidth: 300 }}>{hint}</p>
        : <span />}
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
          {cancelLabel}
        </button>
        <button type="submit" className="btn-primary" disabled={loading || disabled}>
          {loading ? 'En cours…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function FormModal({
  title, subtitle, icon, onClose, children, footer, maxWidth = 560,
  dismissOnOverlay = true, asForm = true, onSubmit,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  dismissOnOverlay?: boolean;
  asForm?: boolean;
  onSubmit?: () => void;
}) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const body = (
    <>
      <div style={{
        padding: '18px 22px', borderBottom: '1px solid var(--bd)',
        display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0,
      }}>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: 'var(--accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 700,
            color: 'var(--tx-primary)', letterSpacing: '-.02em',
          }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: 12.5, color: 'var(--tx-muted)', marginTop: 3, lineHeight: 1.45 }}>
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--tx-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--tx-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-muted)'; }}
        >
          <X size={16} />
        </button>
      </div>
      <div style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
        {children}
      </div>
      {footer}
    </>
  );

  return (
    <div
      className="modal-overlay animate-fade-in"
      onClick={(e) => { if (dismissOnOverlay && e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-box animate-scale-in"
        style={{
          maxWidth, padding: 0, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: 'min(92vh, 860px)',
        }}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {asForm ? (
          <form
            onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}
            style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, overflow: 'hidden' }}
          >
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>
  );
}

export function CredentialsModal({
  title, subtitle, identifiant, identifiantLabel = 'Identifiant',
  password, warning, recap, extra, onClose,
}: {
  title: string;
  subtitle?: string;
  identifiant?: string;
  identifiantLabel?: string;
  password?: string;
  warning?: string;
  recap?: string;
  extra?: React.ReactNode;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<'pwd' | 'all' | null>(null);
  const copy = (value: string, kind: 'pwd' | 'all') => {
    navigator.clipboard?.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2200);
  };

  return (
    <FormModal
      title={title}
      subtitle={subtitle}
      icon={<KeyRound size={18} style={{ color: 'var(--accent)' }} />}
      onClose={onClose}
      dismissOnOverlay={false}
      asForm={false}
      maxWidth={520}
      footer={
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8 }}>
          {recap && (
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => copy(recap, 'all')}>
              {copied === 'all' ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier le récapitulatif</>}
            </button>
          )}
          <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={onClose}>
            J&apos;ai noté — Fermer
          </button>
        </div>
      }
    >
      <div style={{
        background: 'var(--warn-bg)', border: '1.5px solid var(--warn)',
        borderRadius: 14, padding: 16,
      }}>
        <p style={{ fontSize: 12.5, color: 'var(--tx-muted)', lineHeight: 1.55, marginBottom: 14 }}>
          Remettez ces informations en main propre. Le mot de passe temporaire{' '}
          <strong style={{ color: 'var(--tx-primary)' }}>ne sera plus visible</strong> après fermeture.
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {identifiant && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 10.5, color: 'var(--tx-muted)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                {identifiantLabel}
              </p>
              <p style={{ fontSize: 14, fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: 'var(--tx-primary)', userSelect: 'all' }}>
                {identifiant}
              </p>
            </div>
          )}
          {password && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 10,
              padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <p style={{ fontSize: 10.5, color: 'var(--tx-muted)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>
                  Mot de passe temporaire
                </p>
                <p style={{ fontSize: 20, fontFamily: 'ui-monospace, monospace', fontWeight: 800, letterSpacing: '.12em', color: 'var(--tx-primary)', userSelect: 'all' }}>
                  {password}
                </p>
              </div>
              <button type="button" onClick={() => copy(password, 'pwd')} className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12, flexShrink: 0 }}>
                {copied === 'pwd' ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
              </button>
            </div>
          )}
        </div>
        {warning && (
          <p style={{ fontSize: 12.5, color: 'var(--warn)', marginTop: 12, lineHeight: 1.45 }}>{warning}</p>
        )}
      </div>
      {extra}
    </FormModal>
  );
}
