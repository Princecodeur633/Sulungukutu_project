'use client';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface Props {
  isOpen: boolean; title: string; message: string;
  confirmLabel?: string; cancelLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}

export function ConfirmModal({
  isOpen, title, message,
  confirmLabel = 'Confirmer', cancelLabel = 'Annuler',
  variant = 'danger', loading = false,
  onConfirm, onCancel,
}: Props) {
  if (!isOpen) return null;
  const accent = variant === 'danger' ? 'var(--err)' : 'var(--warn)';
  const accentBg = variant === 'danger' ? 'var(--err-bg)' : 'var(--warn-bg)';

  return (
    <div className="modal-overlay animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box animate-scale-in">
        <div style={{ padding:24 }}>
          {/* Icon + Title */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:16 }}>
            <div style={{
              width:40, height:40, borderRadius:10, background:accentBg,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              {variant === 'danger' ? <Trash2 size={18} style={{ color:accent }} /> : <AlertTriangle size={18} style={{ color:accent }} />}
            </div>
            <div style={{ flex:1, paddingTop:2 }}>
              <h3 style={{ fontSize:15, fontWeight:700, color:'var(--tx-primary)', marginBottom:4 }}>{title}</h3>
              <p style={{ fontSize:13, color:'var(--tx-muted)', lineHeight:1.5 }}>{message}</p>
            </div>
            <button onClick={onCancel} style={{
              background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6,
              color:'var(--tx-muted)', transition:'all .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background='var(--bg-subtle)'; e.currentTarget.style.color='var(--tx-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--tx-muted)'; }}
            ><X size={15} /></button>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn-secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
            <button onClick={onConfirm} disabled={loading} style={{
              display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px',
              background:accent, color:'#fff', border:'none', borderRadius:8,
              fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s', opacity: loading ? .6 : 1,
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity='.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity= loading ? '.6' : '1'; }}
            >
              {loading ? <><div className="spinner spinner-sm" style={{ borderTopColor:'#fff', borderColor:'rgba(255,255,255,.3)' }} /> En cours…</> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
