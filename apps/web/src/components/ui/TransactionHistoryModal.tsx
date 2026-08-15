'use client';
import { useState } from 'react';
import { History, X, Ban } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { PAYMENT_TRANSACTION_HISTORY_QUERY, CANCEL_PAYMENT_TRANSACTION_MUTATION } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';

const MODE_LABELS: Record<string, string> = {
  ESPECES: 'Espèces', MOBILE_MONEY: 'Mobile Money', MOBILE_MONEY_SIMULE: 'Mobile Money (simulé)',
  VIREMENT: 'Virement', CHEQUE: 'Chèque', AUTRE: 'Autre',
};
const STATUT_LABELS: Record<string, { label: string; cls: string }> = {
  VALIDEE:  { label: 'Validée',  cls: 'bg-[var(--ok-bg)] text-[var(--ok)]' },
  EN_ATTENTE: { label: 'En attente', cls: 'bg-[var(--warn-bg)] text-[var(--warn)]' },
  ECHOUEE:  { label: 'Échouée',  cls: 'bg-[var(--err-bg)] text-[var(--err)]' },
  ANNULEE:  { label: 'Annulée',  cls: 'bg-[var(--bg-subtle)] text-[var(--tx-muted)]' },
};

interface Props {
  isOpen: boolean;
  studentId: string;
  studentName: string;
  anneeScolaire: string;
  onClose: () => void;
  onChanged: () => void;
}

export function TransactionHistoryModal({ isOpen, studentId, studentName, anneeScolaire, onClose, onChanged }: Props) {
  const [cancelling, setCancelling] = useState<string | null>(null);
  const { data, loading, refetch } = useQuery(PAYMENT_TRANSACTION_HISTORY_QUERY, {
    variables: { studentId, anneeScolaire },
    skip: !isOpen || !studentId,
  });
  const [cancelTx] = useMutation(CANCEL_PAYMENT_TRANSACTION_MUTATION);

  if (!isOpen) return null;

  const transactions = data?.paymentTransactionHistory ?? [];

  const handleCancel = async (transactionId: string) => {
    setCancelling(transactionId);
    try {
      await cancelTx({ variables: { input: { transactionId, observations: 'Annulée depuis le back-office admin' } } });
      await refetch();
      onChanged();
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box animate-scale-in" style={{ maxWidth: 560 }}>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--info-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <History size={18} style={{ color: 'var(--tx-primary)' }} />
            </div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-primary)', marginBottom: 4 }}>
                Historique des paiements
              </h3>
              <p style={{ fontSize: 13, color: 'var(--tx-muted)' }}>{studentName} · {anneeScolaire}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--tx-muted)' }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && <p style={{ fontSize: 13, color: 'var(--tx-muted)' }}>Chargement…</p>}
            {!loading && transactions.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--tx-muted)' }}>Aucune transaction enregistrée pour le moment.</p>
            )}
            {transactions.map((tx: any) => {
              const statutCfg = STATUT_LABELS[tx.statut] ?? { label: tx.statut, cls: '' };
              return (
                <div key={tx.id} style={{
                  border: '1px solid var(--bd)', borderRadius: 10, padding: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-primary)' }}>
                      {Number(tx.montant).toLocaleString('fr-FR')} {tx.devise} · {MODE_LABELS[tx.mode] ?? tx.mode}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 2 }}>
                      {new Date(tx.createdAt).toLocaleString('fr-FR')}
                      {tx.agent?.profile && <> · {tx.agent.profile.prenom} {tx.agent.profile.nom}</>}
                      {tx.numeroRecu && <> · Reçu {tx.numeroRecu}</>}
                    </p>
                    {tx.observations && (
                      <p style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 2, fontStyle: 'italic' }}>{tx.observations}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${statutCfg.cls}`}>{statutCfg.label}</span>
                    {tx.recuUrl && (
                      <button
                        onClick={() => window.open(`${tx.recuUrl}?token=${tokenStorage.get()}`, '_blank')}
                        title="Télécharger le reçu"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-muted)' }}
                      >↓</button>
                    )}
                    {tx.statut === 'VALIDEE' && (
                      <button
                        onClick={() => handleCancel(tx.id)}
                        disabled={cancelling === tx.id}
                        title="Annuler cette transaction"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--err)', opacity: cancelling === tx.id ? .5 : 1 }}
                      >
                        <Ban size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
