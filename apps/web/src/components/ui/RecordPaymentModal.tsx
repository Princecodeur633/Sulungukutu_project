'use client';
import { useState } from 'react';
import { Wallet, CheckCircle2, XCircle } from 'lucide-react';
import { useMutation } from '@apollo/client';
import { RECORD_MANUAL_PAYMENT_MUTATION } from '@/lib/graphql/queries';
import { FormModal, FormField, FormSection, FormGrid, FormActions } from '@/components/ui/FormModal';

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
    <FormModal
      title={`Encaissement — ${MOIS_LABELS[mois] ?? `Mois ${mois}`}`}
      subtitle={studentName}
      icon={<Wallet size={18} style={{ color: 'var(--accent)' }} />}
      onClose={handleClose}
      onSubmit={result ? handleClose : handleRecord}
      maxWidth={480}
      asForm={!result}
      footer={result ? (
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--bd)' }}>
          <button type="button" className="btn-primary" style={{ width: '100%' }} onClick={handleClose}>Fermer</button>
        </div>
      ) : (
        <FormActions
          submitLabel="Encaisser"
          loading={loading}
          onCancel={handleClose}
          disabled={montant <= 0}
        />
      )}
    >
      {result ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12,
          background: result.ok ? 'var(--ok-bg)' : 'var(--err-bg)',
        }}>
          {result.ok
            ? <CheckCircle2 size={20} style={{ color: 'var(--ok)', flexShrink: 0 }} />
            : <XCircle size={20} style={{ color: 'var(--err)', flexShrink: 0 }} />}
          <p style={{ fontSize: 13, color: 'var(--tx-primary)', lineHeight: 1.5 }}>{result.message}</p>
        </div>
      ) : (
        <FormSection icon={<Wallet size={14} style={{ color: 'var(--accent)' }} />} title="Règlement">
          <FormGrid>
            <FormField label="Montant (XAF)" required>
              <input className="input" type="number" value={montant}
                onChange={e => setMontant(Number(e.target.value))} disabled={loading} />
            </FormField>
            <FormField label="Mode de paiement">
              <select className="input" value={mode} onChange={e => setMode(e.target.value)} disabled={loading}>
                {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </FormField>
          </FormGrid>
          <FormField label="Observations" hint="Facultatif">
            <textarea className="input resize-none" rows={2} value={observations}
              onChange={e => setObservations(e.target.value)} disabled={loading} />
          </FormField>
        </FormSection>
      )}
    </FormModal>
  );
}
