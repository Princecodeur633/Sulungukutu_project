'use client';
import { useState } from 'react';
import { Wallet, X, CheckCircle2, XCircle } from 'lucide-react';
import { useMutation } from '@apollo/client';
import { RECORD_MANUAL_PAYMENT_MUTATION } from '@/lib/graphql/queries';

const MOIS_LABELS: Record<number, string> = {
  1: 'Septembre', 2: 'Octobre', 3: 'Novembre', 4: 'Décembre',
  5: 'Janvier', 6: 'Février', 7: 'Mars', 8: 'Avril', 9: 'Mai',
};

const MODES = [
  { value: 'ESPECES',  label: 'Espèces' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CHEQUE',   label: 'Chèque' },
  { value: 'AUTRE',    label: 'Autre' },
];

interface Props {
  isOpen: boolean;
  studentId: string;
  studentName: string;
  mois: number;
  anneeScolaire: string;
  montantSuggere: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  isOpen, studentId, studentName, mois, anneeScolaire, montantSuggere, onClose, onSuccess,
}: Props) {
  const [montant, setMontant] = useState<number>(montantSuggere);
  const [mode, setMode] = useState('ESPECES');
  const [observations, setObservations] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [recordManualPayment, { loading }] = useMutation(RECORD_MANUAL_PAYMENT_MUTATION);

  if (!isOpen) return null;

  const reset = () => { setMontant(montantSuggere); setMode('ESPECES'); setObservations(''); setResult(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleRecord = async () => {
    setResult(null);
    try {
      const { data } = await recordManualPayment({
        variables: { input: { studentId, mois, anneeScolaire, montant, mode, observations: observations || null } },
      });
      const tx = data?.recordManualPayment?.transaction;
      setResult({ ok: true, message: `Encaissement enregistré — reçu n° ${tx?.numeroRecu ?? ''}` });
      onSuccess();
    } catch (err: any) {
      setResult({ ok: false, message: err?.message ?? 'Une erreur est survenue.' });
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal-box animate-scale-in">
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--ok-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Wallet size={18} style={{ color: 'var(--ok)' }} />
            </div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-primary)', marginBottom: 4 }}>
                Encaissement — {MOIS_LABELS[mois] ?? `Mois ${mois}`}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--tx-muted)' }}>{studentName}</p>
            </div>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--tx-muted)' }}>
              <X size={15} />
            </button>
          </div>

          {!result && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-secondary)', display: 'block', marginBottom: 6 }}>
                    Montant (XAF)
                  </label>
                  <input
                    type="number"
                    value={montant}
                    onChange={e => setMontant(Number(e.target.value))}
                    disabled={loading}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--bd)', fontSize: 14, background: 'var(--bg)', color: 'var(--tx-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-secondary)', display: 'block', marginBottom: 6 }}>
                    Mode de paiement
                  </label>
                  <select
                    className="input"
                    value={mode}
                    onChange={e => setMode(e.target.value)}
                    disabled={loading}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--bd)', fontSize: 14, background: 'var(--bg)', color: 'var(--tx-primary)' }}
                  >
                    {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-secondary)', display: 'block', marginBottom: 6 }}>
                Observations (optionnel)
              </label>
              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                disabled={loading}
                rows={2}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--bd)', fontSize: 13, marginBottom: 18, background: 'var(--bg)', color: 'var(--tx-primary)', resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={handleClose} disabled={loading}>Annuler</button>
                <button
                  onClick={handleRecord}
                  disabled={loading || montant <= 0}
                  style={{
                    padding: '8px 16px', background: 'var(--ok)', color: '#fff', border: 'none',
                    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: (loading || montant <= 0) ? .6 : 1,
                  }}
                >
                  {loading ? 'Enregistrement…' : 'Encaisser'}
                </button>
              </div>
            </>
          )}

          {result && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10,
                background: result.ok ? 'var(--ok-bg)' : 'var(--err-bg)', marginBottom: 16,
              }}>
                {result.ok
                  ? <CheckCircle2 size={20} style={{ color: 'var(--ok)', flexShrink: 0 }} />
                  : <XCircle size={20} style={{ color: 'var(--err)', flexShrink: 0 }} />}
                <p style={{ fontSize: 13, color: 'var(--tx-primary)', lineHeight: 1.5 }}>{result.message}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleClose}
                  style={{ padding: '8px 16px', background: 'var(--ok)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
