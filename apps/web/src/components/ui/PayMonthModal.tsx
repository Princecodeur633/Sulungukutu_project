'use client';
import { useState } from 'react';
import { Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import { useMutation } from '@apollo/client';
import { INITIATE_REMOTE_PAYMENT_MUTATION } from '@/lib/graphql/queries';
import { openApiDocument } from '@/lib/api';
import { FormModal, FormField, FormSection, FormActions } from '@/components/ui/FormModal';

const MOIS_LABELS: Record<number, string> = {
  1: 'Septembre', 2: 'Octobre', 3: 'Novembre', 4: 'Décembre',
  5: 'Janvier', 6: 'Février', 7: 'Mars', 8: 'Avril', 9: 'Mai',
};

const FAILURE_MESSAGES: Record<string, string> = {
  SOLDE_INSUFFISANT: "Solde insuffisant sur ce numéro Mobile Money.",
  NUMERO_INVALIDE:   "Ce numéro ne semble pas valide. Vérifiez le format (ex: 06 XXX XX XX).",
  ERREUR_RESEAU:     "Erreur réseau côté opérateur. Réessayez dans un instant.",
  DELAI_EXPIRE:      "Le délai de confirmation a expiré. Réessayez.",
};

interface Props {
  isOpen: boolean;
  studentId: string;
  mois: number;
  anneeScolaire: string;
  montantDu: number;
  onClose: () => void;
  onSuccess: () => void; // déclenché après un paiement VALIDEE, pour rafraîchir le résumé
}

export function PayMonthModal({ isOpen, studentId, mois, anneeScolaire, montantDu, onClose, onSuccess }: Props) {
  const [numeroTelephone, setNumero] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string; recuUrl?: string | null } | null>(null);
  const [initiateRemotePayment, { loading }] = useMutation(INITIATE_REMOTE_PAYMENT_MUTATION);

  if (!isOpen) return null;

  const reset = () => { setNumero(''); setResult(null); };
  const handleClose = () => { reset(); onClose(); };

  const handlePay = async () => {
    setResult(null);
    try {
      const { data } = await initiateRemotePayment({
        variables: {
          input: { studentId, mois, anneeScolaire, montant: montantDu, numeroTelephone },
        },
      });
      const tx = data?.initiateRemotePayment?.transaction;
      const payment = data?.initiateRemotePayment?.payment;
      if (tx?.statut === 'VALIDEE') {
        setResult({
          ok: true,
          message: `Paiement confirmé — reçu n° ${tx.numeroRecu ?? tx.transactionRef}`,
          recuUrl: payment?.recuUrl ?? tx?.recuUrl,
        });
        onSuccess();
      } else {
        const reason = tx?.codeEchec ? FAILURE_MESSAGES[tx.codeEchec] : null;
        setResult({ ok: false, message: reason ?? "Le paiement n'a pas abouti. Réessayez." });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message ?? 'Une erreur est survenue. Réessayez.' });
    }
  };

  return (
    <FormModal
      title={`Paiement Mobile Money — ${MOIS_LABELS[mois] ?? `Mois ${mois}`}`}
      subtitle={`Montant dû : ${montantDu.toLocaleString('fr-FR')} XAF`}
      icon={<Smartphone size={18} style={{ color: 'var(--accent)' }} />}
      onClose={handleClose}
      onSubmit={result ? handleClose : handlePay}
      maxWidth={480}
      asForm={!result}
      footer={result ? (
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!result.ok && (
            <button type="button" className="btn-secondary" onClick={() => setResult(null)}>Réessayer</button>
          )}
          {result.ok && result.recuUrl && (
            <button type="button" className="btn-secondary" onClick={() => openApiDocument(result.recuUrl)}>Voir le reçu</button>
          )}
          <button type="button" className="btn-primary" onClick={handleClose}>Fermer</button>
        </div>
      ) : (
        <FormActions
          submitLabel={loading ? 'Traitement…' : 'Payer maintenant'}
          loading={loading}
          onCancel={handleClose}
          disabled={numeroTelephone.trim().length < 8}
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
        <FormSection icon={<Smartphone size={14} style={{ color: 'var(--accent)' }} />} title="Numéro">
          <FormField
            label="Mobile Money"
            required
            hint="8 chiffres ou plus. Évitez les suffixes 0000, 1111 et 9999 (cas de test d’échec)."
          >
            <input className="input" type="tel" placeholder="06 XXX XX XX"
              value={numeroTelephone} onChange={e => setNumero(e.target.value)} disabled={loading} />
          </FormField>
        </FormSection>
      )}
    </FormModal>
  );
}
