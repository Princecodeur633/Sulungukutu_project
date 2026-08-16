'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { CreditCard, CheckCircle, XCircle, AlertCircle, Search, Filter, Download, History } from 'lucide-react';
import {
  CLASSES_BY_SCHOOL_QUERY,
  STUDENTS_BY_CLASS_QUERY,
  PAYMENTS_BY_STUDENT_QUERY,
  UPDATE_PAYMENT_STATUS_MUTATION,
  RECORD_MANUAL_PAYMENT_MUTATION,
  MY_SCHOOL_QUERY,
} from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { useActionToast } from '@/hooks/useActionToast';
import { useToast } from '@/components/ui/Toast';
import { RecordPaymentModal } from '@/components/ui/RecordPaymentModal';
import { TransactionHistoryModal } from '@/components/ui/TransactionHistoryModal';

const MOIS_LABELS = ['', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai'];

const STATUS_CONFIG = {
  PAYE:    { label: 'Payé',     icon: CheckCircle,  cls: 'bg-[var(--ok-bg)] text-[var(--ok)] border-[var(--bd)]' },
  PARTIEL: { label: 'Partiel',  icon: AlertCircle,  cls: 'bg-[var(--warn-bg)] text-[var(--warn)] border-amber-200' },
  IMPAYE:  { label: 'Impayé',   icon: XCircle,      cls: 'bg-[var(--err-bg)] text-[var(--err)] border-red-200' },
  EXONERE: { label: 'Exonéré',  icon: AlertCircle,  cls: 'bg-[var(--warn-bg)] text-[var(--warn)] border-amber-200' },
  ANNULE:  { label: 'Annulé',   icon: XCircle,      cls: 'bg-[var(--bg-subtle)] text-[var(--tx-muted)] border-[var(--bd)]' },
};

function PaymentStatusBadge({ statut }: { statut: string }) {
  const cfg = STATUS_CONFIG[statut as keyof typeof STATUS_CONFIG];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${cfg.cls}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

function PaymentRow({
  student, anneeScolaire, onUpdate, filterStatus,
}: {
  student: any; anneeScolaire: string; onUpdate: () => void; filterStatus: string;
}) {
  const profile = student.membership?.profile;
  const studentName = `${profile?.prenom ?? ''} ${profile?.nom ?? ''}`.trim();
  const run = useActionToast();
  const { data, refetch: refetchPayments } = useQuery(PAYMENTS_BY_STUDENT_QUERY, {
    variables: { studentId: student.id, anneeScolaire },
  });
  const [updatePayment] = useMutation(UPDATE_PAYMENT_STATUS_MUTATION);
  const [selected, setSelected] = useState<number[]>([]);
  const [newStatus, setNewStatus] = useState<'PAYE' | 'EXONERE' | 'IMPAYE'>('EXONERE');
  const [recordingMonth, setRecordingMonth] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const summary = data?.paymentsByStudent;
  const payments = summary?.moisDetails ?? [];

  if (filterStatus && payments.length > 0 && !payments.some((p: any) => p.statut === filterStatus)) {
    return null;
  }

  const refreshAll = () => { refetchPayments(); onUpdate(); };

  const toggleMonth = (mois: number) => {
    setSelected((prev) =>
      prev.includes(mois) ? prev.filter((m) => m !== mois) : [...prev, mois]
    );
  };

  const handleUpdate = async () => {
    if (selected.length === 0) return;
    const result = await run(
      () => updatePayment({
        variables: {
          input: {
            studentId: student.id,
            anneeScolaire,
            mois:   selected,
            statut: newStatus,
          },
        },
      }),
      { success: `${selected.length} paiement(s) mis à jour` }
    );
    if (result) { setSelected([]); onUpdate(); }
  };

  return (
    <tr className="hover:bg-[var(--bg-subtle)] transition-colors">
      {/* Élève */}
      <td className="table-cell">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--info-bg)] flex items-center justify-center
                          text-[var(--tx-primary)] font-bold text-sm">
            {profile?.prenom?.[0] ?? '?'}
          </div>
          <div>
            <p className="font-semibold text-[var(--tx-primary)] text-sm">{profile?.prenom} {profile?.nom}</p>
            <p className="text-xs text-[var(--tx-muted)]">{student.matricule}</p>
            {student.parents?.[0] && (
              <p className="text-xs text-[var(--tx-muted)] mt-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                {student.parents[0].parent?.profile?.prenom} {student.parents[0].parent?.profile?.nom}
                {student.parents[0].parent?.profile?.phone && (
                  <span className="text-[var(--tx-muted)]">· {student.parents[0].parent.profile.phone}</span>
                )}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* 9 mois */}
      {[1,2,3,4,5,6,7,8,9].map((mois) => {
        const p = payments.find((pay: any) => pay.mois === mois);
        const isSelected = selected.includes(mois);
        const restant = p ? Math.max(0, (p.montantDu ?? 0) - (p.montantPaye ?? 0)) : 0;
        return (
          <td key={mois} className="table-cell text-center">
            <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => toggleMonth(mois)}
              className={`w-16 py-1 rounded-md text-xs font-semibold border transition-all
                ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105' : ''}
                ${p?.statut === 'PAYE'    ? 'bg-[var(--ok-bg)] text-[var(--ok)] border-[var(--bd)] hover:bg-emerald-200' : ''}
                ${p?.statut === 'PARTIEL' ? 'bg-[var(--warn-bg)] text-[var(--warn)] border-amber-200' : ''}
                ${p?.statut === 'IMPAYE'  ? 'bg-[var(--err-bg)] text-[var(--err)] border-red-200 hover:bg-red-200' : ''}
                ${p?.statut === 'EXONERE' ? 'bg-[var(--warn-bg)] text-[var(--warn)] border-amber-200' : ''}
                ${p?.statut === 'ANNULE'  ? 'bg-[var(--bg-subtle)] text-[var(--tx-muted)] border-[var(--bd)]' : ''}
                ${!p ? 'bg-[var(--bg-subtle)] text-[var(--tx-muted)] border-[var(--bd)]' : ''}
              `}
            >
              {p ? STATUS_CONFIG[p.statut as keyof typeof STATUS_CONFIG]?.label ?? p.statut : '—'}
            </button>
            {p?.statut === 'PARTIEL' && (
              <span style={{ fontSize: 10, color: 'var(--tx-muted)' }}>reste {restant.toLocaleString('fr-FR')}</span>
            )}
            {p?.recuUrl && (
              <button
                onClick={() => window.open(`${p.recuUrl}?token=${tokenStorage.get()}`, '_blank')}
                title="Télécharger le reçu"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-muted)', padding: 2 }}
              >
                <Download size={11} />
              </button>
            )}
            {(!p || p.statut === 'IMPAYE' || p.statut === 'PARTIEL') && (
              <button
                onClick={() => setRecordingMonth(mois)}
                title="Encaisser au guichet (espèces, virement, chèque...)"
                style={{
                  background: 'var(--ok)', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '2px 6px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Encaisser
              </button>
            )}
            </div>
          </td>
        );
      })}

      {/* Actions */}
      <td className="table-cell">
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <>
              <select
                className="input py-1 text-xs w-32"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
              >
                <option value="EXONERE">Exonérer</option>
                <option value="IMPAYE">Marquer impayé</option>
                <option value="PAYE">Forcer payé (sans montant)</option>
              </select>
              <button onClick={handleUpdate} className="btn-primary py-1 px-2 text-xs">
                ✓ {selected.length} mois
              </button>
            </>
          )}
          <button
            onClick={() => setHistoryOpen(true)}
            title="Historique des transactions"
            className="text-[var(--tx-muted)] hover:text-[var(--tx-primary)] transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <History size={14} />
          </button>
        </div>
      </td>

      <RecordPaymentModal
        isOpen={recordingMonth !== null}
        studentId={student.id}
        studentName={studentName}
        mois={recordingMonth ?? 0}
        anneeScolaire={anneeScolaire}
        montantSuggere={(() => {
          const p = payments.find((pay: any) => pay.mois === recordingMonth);
          return p ? Math.max(0, (p.montantDu ?? 0) - (p.montantPaye ?? 0)) : 0;
        })()}
        onClose={() => setRecordingMonth(null)}
        onSuccess={refreshAll}
      />
      <TransactionHistoryModal
        isOpen={historyOpen}
        studentId={student.id}
        studentName={studentName}
        anneeScolaire={anneeScolaire}
        onClose={() => setHistoryOpen(false)}
        onChanged={refreshAll}
      />
    </tr>
  );
}

export default function AdminPaymentsPage() {
  const schoolId      = tokenStorage.getSchoolId() ?? '';
  const [classId, setClassId]     = useState('');
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('');
  const { data: mySchoolData }    = useQuery(MY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  const anneeScolaire             = mySchoolData?.mySchool?.anneeScolaire ?? '2024-2025';
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const handleExport = async () => {
    if (!classId) return;
    setExporting(true);
    try {
      const cls  = classes.find((c: any) => c.id === classId);
      const url  = `${process.env.NEXT_PUBLIC_API_URL?.replace('/graphql', '') ?? 'http://localhost:4000'}/export/payments?classId=${classId}&anneeScolaire=${anneeScolaire}&className=${encodeURIComponent(cls?.nom ?? '')}`;
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${tokenStorage.getToken()}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(body.error ?? `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `Paiements_${cls?.nom ?? 'export'}_${anneeScolaire}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Export réussi', `Paiements de ${cls?.nom} téléchargés.`);
    } catch (err: any) {
      toast.error('Échec de l\'export', err.message);
    } finally { setExporting(false); }
  };

  const { data: classData } = useQuery(CLASSES_BY_SCHOOL_QUERY, {
    variables: { schoolId }, skip: !schoolId,
    pollInterval: 30_000,
  });
  const { data: studentData, refetch } = useQuery(STUDENTS_BY_CLASS_QUERY, {
    variables: { classId, pagination: { page: 1, limit: 200 } },
    skip: !classId,
  });

  const classes  = classData?.classesBySchool ?? [];
  const students = studentData?.studentsByClass?.data ?? [];

  const filtered = students.filter((s: any) => {
    const name = `${s.membership?.profile?.prenom} ${s.membership?.profile?.nom}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || s.matricule.includes(search);
    return matchSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Paiements</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">
            Année scolaire {anneeScolaire} · Cliquez sur un mois pour le sélectionner
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={!classId || exporting}
          className="btn-secondary disabled:opacity-50 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {exporting ? 'Export...' : 'Exporter .xlsx'}
        </button>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <select
          className="input py-1.5 text-sm w-52"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">— Sélectionner une classe —</option>
          {classes.map((c: any) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
          <input
            className="input pl-8 py-1.5 text-sm w-52"
            placeholder="Rechercher un élève..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
          <select
            className="input pl-8 py-1.5 text-sm w-44"
            value={filterStatus}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Légende */}
        <div className="flex items-center gap-3 ml-auto">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2.5 h-2.5 rounded-sm border ${v.cls}`} />
              <span className="text-[var(--tx-secondary)]">{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {!classId ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
            <CreditCard size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Sélectionnez une classe pour gérer les paiements</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-48">Élève</th>
                  {[1,2,3,4,5,6,7,8,9].map((m) => (
                    <th key={m} className="table-header text-center w-20">
                      {MOIS_LABELS[m].substring(0, 3)}.
                    </th>
                  ))}
                  <th className="table-header w-48">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-[var(--tx-muted)] text-sm">
                      Aucun élève dans cette classe
                    </td>
                  </tr>
                ) : (
                  filtered.map((s: any) => (
                    <PaymentRow
                      key={s.id}
                      student={s}
                      anneeScolaire={anneeScolaire}
                      onUpdate={refetch}
                      filterStatus={filterStatus}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
