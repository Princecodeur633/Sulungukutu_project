'use client';

import { useQuery } from '@apollo/client';
import { PARENT_DASHBOARD_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { useState } from 'react';
import {
  TrendingUp, UserCheck, CreditCard, FileText,
  AlertTriangle, ChevronRight, CheckCircle, XCircle, Clock, Users
} from 'lucide-react';
import Link from 'next/link';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { chartColors } from '@/lib/chartColors';

const MOIS_LABELS = ['','Sept.','Oct.','Nov.','Déc.','Janv.','Févr.','Mars','Avr.','Mai'];
const MENTION_COLORS: Record<string, string> = {
  EXCELLENT:'text-[var(--ok)]', TRES_BIEN:'text-[var(--ok)]', BIEN:'text-lime-600',
  ASSEZ_BIEN:'text-yellow-600', PASSABLE:'text-[var(--warn)]', INSUFFISANT:'text-[var(--err)]',
};

function ChildCard({ childData, active, onClick }: {
  childData: any; active: boolean; onClick: () => void;
}) {
  const { student, moyenneGenerale, presenceRate, currentMonthPayment, unpaidMonths } = childData;
  const profile = student?.membership?.profile;
  const avg     = moyenneGenerale ? parseFloat(moyenneGenerale).toFixed(2) : null;
  const pct     = presenceRate   ? Math.round(presenceRate * 100)           : null;
  const payOk   = currentMonthPayment?.statut === 'PAYE' || currentMonthPayment?.statut === 'EXONERE';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all
        ${active ? 'border-[var(--bd-strong)] bg-[var(--info-bg)]' : 'border-[var(--bd)] bg-[var(--bg-card)] hover:border-[var(--bd)]'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-[var(--info-bg)] flex items-center justify-center
                        text-[var(--tx-primary)] font-bold text-lg flex-shrink-0">
          {profile?.avatarUrl
            ? <img src={profile.avatarUrl} className="w-full h-full rounded-full object-cover" />
            : profile?.prenom?.[0] ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[var(--tx-primary)]">{profile?.prenom} {profile?.nom}</p>
          <p className="text-xs text-[var(--tx-muted)]">{student?.class?.nom}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[var(--bg-card)] rounded-lg p-2 border border-[var(--bd)]">
          <p className={`text-lg font-black ${avg ? (parseFloat(avg) >= 10 ? 'text-[var(--ok)]' : 'text-[var(--err)]') : 'text-[var(--tx-muted)]'}`}>
            {avg ?? '—'}
          </p>
          <p className="text-xs text-[var(--tx-muted)]">Moy. gén.</p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-lg p-2 border border-[var(--bd)]">
          <p className={`text-lg font-black ${pct !== null ? (pct >= 80 ? 'text-[var(--ok)]' : 'text-[var(--warn)]') : 'text-[var(--tx-muted)]'}`}>
            {pct !== null ? `${pct}%` : '—'}
          </p>
          <p className="text-xs text-[var(--tx-muted)]">Présence</p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-lg p-2 border border-[var(--bd)]">
          {payOk
            ? <CheckCircle size={20} className="text-[var(--ok)] mx-auto" />
            : <XCircle    size={20} className="text-[var(--err)] mx-auto" />}
          <p className="text-xs text-[var(--tx-muted)] mt-0.5">Paiement</p>
        </div>
      </div>

      {unpaidMonths?.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--err)] font-medium">
          <AlertTriangle size={12} />
          {unpaidMonths.length} mensualité(s) impayée(s)
        </div>
      )}
    </button>
  );
}

function ChildDetail({ childData }: { childData: any }) {
  const { student, moyenneGenerale, presenceRate, recentGrades, recentAbsences, unpaidMonths } = childData;
  const profile = student?.membership?.profile;

  return (
    <div className="space-y-4">
      {/* Entête */}
      <div className="card flex items-center gap-4 py-4">
        <div className="w-14 h-14 rounded-full bg-[var(--info-bg)] flex items-center justify-center
                        text-[var(--tx-primary)] font-bold text-xl flex-shrink-0">
          {profile?.prenom?.[0] ?? '?'}
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--tx-primary)]">{profile?.prenom} {profile?.nom}</h2>
          <p className="text-[var(--tx-muted)] text-sm">{student?.class?.nom} · Matr. {student?.matricule}</p>
        </div>
        <Link href={`/parent/children/${student?.id}`}
          className="ml-auto btn-secondary py-1.5 text-xs">
          Fiche complète <ChevronRight size={13} />
        </Link>
      </div>

      {/* Moyenne & présence — jauges visuelles */}
      <div className="card flex items-center justify-around py-5">
        <ProgressRing
          percent={presenceRate ? presenceRate * 100 : 0}
          color={chartColors.emerald}
          size={84}
          label="Présence"
        />
        <ProgressRing
          percent={moyenneGenerale ? (parseFloat(moyenneGenerale) / 20) * 100 : 0}
          color={chartColors.accent}
          size={84}
          centerValue={moyenneGenerale ? `${parseFloat(moyenneGenerale).toFixed(1)}` : '—'}
          label="Moyenne /20"
        />
      </div>

      {/* Paiements impayés */}
      {unpaidMonths?.length > 0 && (
        <div className="card bg-[var(--err-bg)] border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-[var(--err)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--err)] text-sm">Mensualités impayées</p>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {unpaidMonths.map((p: any) => (
                  <span key={p.mois} className="badge badge-danger">
                    {MOIS_LABELS[p.mois]}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[var(--err)] mt-2">
                Rapprochez-vous de l'administration pour régulariser la situation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dernières notes */}
      <div className="card">
        <h3 className="font-semibold text-[var(--tx-secondary)] mb-3 flex items-center gap-2">
          <TrendingUp size={15} className="text-[var(--tx-secondary)]" /> Dernières notes
        </h3>
        {recentGrades?.length === 0 ? (
          <p className="text-[var(--tx-muted)] text-sm">Aucune note disponible</p>
        ) : (
          <div className="space-y-2">
            {recentGrades?.slice(0, 5).map((g: any, i: number) => {
              const val = parseFloat(g.valeur);
              return (
                <div key={i} className="flex items-center justify-between py-1.5
                                         border-b border-[var(--bd)] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--tx-secondary)]">
                      {g.classSubject?.subject?.nom}
                    </p>
                    <p className="text-xs text-[var(--tx-muted)]">{g.typeEval} · {g.trimestre}</p>
                  </div>
                  <span className={`text-base font-black
                    ${val >= 14 ? 'text-[var(--ok)]' : val >= 10 ? 'text-[var(--warn)]' : 'text-[var(--err)]'}`}>
                    {val.toFixed(2)}/20
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Absences récentes */}
      <div className="card">
        <h3 className="font-semibold text-[var(--tx-secondary)] mb-3 flex items-center gap-2">
          <UserCheck size={15} className="text-[var(--err)]" /> Absences récentes
        </h3>
        {recentAbsences?.length === 0 ? (
          <p className="text-sm text-[var(--tx-muted)] flex items-center gap-1.5">
            <CheckCircle size={14} className="text-[var(--ok)]" />
            Aucune absence enregistrée
          </p>
        ) : (
          <div className="space-y-2">
            {recentAbsences?.map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5
                                       border-b border-[var(--bd)] last:border-0">
                <div className="flex items-center gap-2">
                  <XCircle size={14} className="text-[var(--err)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--tx-secondary)]">
                      {a.classSubject?.subject?.nom ?? 'Cours'}
                    </p>
                    <p className="text-xs text-[var(--tx-muted)]">
                      {a.motif ? `Motif : ${a.motif}` : 'Non justifiée'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-[var(--tx-muted)]">
                  {new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ParentDashboardPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [activeIdx, setActiveIdx] = useState(0);

  const { data, loading } = useQuery(PARENT_DASHBOARD_QUERY, {
    variables: { schoolId }, skip: !schoolId,
    pollInterval: 30_000,
  });

  const children = data?.parentDashboard?.children ?? [];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  if (children.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 text-[var(--tx-muted)]">
      <Users size={40} className="mb-3 opacity-40" />
      <p className="font-medium">Aucun enfant lié à votre compte</p>
      <p className="text-sm mt-1">Contactez l'administration pour lier vos enfants.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Tableau de bord</h1>
        <p className="text-[var(--tx-muted)] text-sm mt-0.5">
          Suivez la scolarité de {children.length === 1 ? 'votre enfant' : 'vos enfants'}
        </p>
      </div>

      <div className={`grid gap-5 ${children.length > 1 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {/* Colonne gauche : sélecteurs enfants */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--tx-muted)] uppercase tracking-wider">
            {children.length === 1 ? 'Mon enfant' : 'Mes enfants'}
          </h2>
          {children.map((child: any, i: number) => (
            <ChildCard
              key={child.student?.id ?? i}
              childData={child}
              active={activeIdx === i}
              onClick={() => setActiveIdx(i)}
            />
          ))}
        </div>

        {/* Colonne droite : détail enfant actif */}
        <div className={children.length > 1 ? 'lg:col-span-2' : ''}>
          {children[activeIdx] && <ChildDetail childData={children[activeIdx]} />}
        </div>
      </div>
    </div>
  );
}
