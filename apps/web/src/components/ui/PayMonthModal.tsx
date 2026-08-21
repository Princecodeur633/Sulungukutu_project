'use client';
import { useState } from 'react';
import { Smartphone, X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useMutation } from '@apollo/client';
import { INITIATE_REMOTE_PAYMENT_MUTATION } from '@/lib/graphql/queries';
import { openApiDocument } from '@/lib/api';

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
    <div className="modal-overlay animate-fade-in" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal-box animate-scale-in">
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--warn-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Smartphone size={18} style={{ color: 'var(--warn)' }} />
            </div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-primary)', marginBottom: 4 }}>
                Paiement Mobile Money — {MOIS_LABELS[mois] ?? `Mois ${mois}`}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--tx-muted)', lineHeight: 1.5 }}>
                Simulation de paiement à distance. Montant dû : <strong>{montantDu.toLocaleString('fr-FR')} XAF</strong>
                <br />
                Saisissez un numéro à 8 chiffres ou plus (ex. 06 123 45 67). Évitez les suffixes 0000, 1111 et 9999 (cas de test d&apos;échec).
              </p>
            </div>
            <button onClick={handleClose} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6,
              color: 'var(--tx-muted)',
            }}><X size={15} /></button>
          </div>

          {!result && (
            <>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-secondary)', display: 'block', marginBottom: 6 }}>
                Numéro Mobile Money
              </label>
              <input
                type="tel"
                placeholder="06 XXX XX XX"
                value={numeroTelephone}
                onChange={e => setNumero(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--bd)', fontSize: 14, marginBottom: 18,
                  background: 'var(--bg)', color: 'var(--tx-primary)',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={handleClose} disabled={loading}>Annuler</button>
                <button
                  onClick={handlePay}
                  disabled={loading || numeroTelephone.trim().length < 8}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                    background: 'var(--warn)', color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: (loading || numeroTelephone.trim().length < 8) ? .6 : 1,
                  }}
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Traitement…</> : 'Payer maintenant'}
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
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {!result.ok && (
                  <button className="btn-secondary" onClick={() => setResult(null)}>Réessayer</button>
                )}
                {result.ok && result.recuUrl && (
                  <button className="btn-secondary" onClick={() => openApiDocument(result.recuUrl)}>
                    Voir le reçu
                  </button>
                )}
                <button
                  onClick={handleClose}
                  style={{
                    padding: '8px 16px', background: 'var(--ok)', color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
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
