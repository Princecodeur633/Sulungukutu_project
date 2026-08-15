'use client';

import { useQuery } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { PARENT_DASHBOARD_QUERY } from '@/lib/graphql/queries';
import Link from 'next/link';
import { Users, ChevronRight, TrendingUp, UserCheck, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ParentChildrenPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';

  const { data, loading } = useQuery(PARENT_DASHBOARD_QUERY, {
    variables: { schoolId }, skip: !schoolId,
  });

  const children = data?.parentDashboard?.children ?? [];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Mes enfants</h1>
        <p className="text-[var(--tx-muted)] text-sm mt-0.5">
          {children.length} enfant{children.length > 1 ? 's' : ''} lié{children.length > 1 ? 's' : ''} à votre compte
        </p>
      </div>

      {children.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <Users size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Aucun enfant lié à votre compte</p>
          <p className="text-sm mt-1">Contactez l'administration pour lier vos enfants.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {children.map((child: any) => {
            const { student, moyenneGenerale, presenceRate, unpaidMonths } = child;
            const profile = student?.membership?.profile;
            const avg = moyenneGenerale ? parseFloat(moyenneGenerale).toFixed(2) : null;
            const pct = presenceRate ? Math.round(presenceRate * 100) : null;

            return (
              <Link key={student?.id} href={`/parent/children/${student?.id}`}
                className="card-hover block">
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 rounded-full bg-[var(--info-bg)] flex items-center justify-center
                                  text-[var(--tx-primary)] font-bold text-xl flex-shrink-0">
                    {profile?.prenom?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-[var(--tx-primary)] text-lg">
                      {profile?.prenom} {profile?.nom}
                    </h2>
                    <p className="text-sm text-[var(--tx-muted)]">
                      {student?.class?.nom} · {student?.class?.level?.nom}
                    </p>
                    <p className="text-xs font-mono text-[var(--tx-muted)] mt-0.5">{student?.matricule}</p>
                  </div>
                  <ChevronRight size={18} className="text-[var(--tx-muted)] flex-shrink-0" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--bd)]">
                    <p className={`text-xl font-black
                      ${avg ? (parseFloat(avg) >= 10 ? 'text-[var(--ok)]' : 'text-[var(--err)]') : 'text-[var(--tx-muted)]'}`}>
                      {avg ?? '—'}
                    </p>
                    <p className="text-xs text-[var(--tx-muted)] mt-0.5 flex items-center justify-center gap-1">
                      <TrendingUp size={10} /> Moyenne
                    </p>
                  </div>
                  <div className="text-center p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--bd)]">
                    <p className={`text-xl font-black
                      ${pct !== null ? (pct >= 80 ? 'text-[var(--ok)]' : 'text-[var(--warn)]') : 'text-[var(--tx-muted)]'}`}>
                      {pct !== null ? `${pct}%` : '—'}
                    </p>
                    <p className="text-xs text-[var(--tx-muted)] mt-0.5 flex items-center justify-center gap-1">
                      <UserCheck size={10} /> Présence
                    </p>
                  </div>
                  <div className="text-center p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--bd)]">
                    {(unpaidMonths?.length ?? 0) === 0 ? (
                      <CheckCircle size={20} className="text-[var(--ok)] mx-auto mt-0.5" />
                    ) : (
                      <p className="text-xl font-black text-[var(--err)]">{unpaidMonths.length}</p>
                    )}
                    <p className="text-xs text-[var(--tx-muted)] mt-0.5 flex items-center justify-center gap-1">
                      <CreditCard size={10} /> Paiements
                    </p>
                  </div>
                </div>

                {/* Alerte impayés */}
                {(unpaidMonths?.length ?? 0) > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--err)] font-medium">
                    <AlertTriangle size={12} />
                    {unpaidMonths.length} mensualité(s) impayée(s) — cliquez pour plus de détails
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
