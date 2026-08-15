'use client';

import { MY_ATTENDANCE_QUERY, MY_STUDENT_PROFILE_QUERY } from '@/lib/graphql/queries';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { UserCheck, UserX, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

const STATUT_CONFIG = {
  PRESENT: { label: 'Présent', icon: UserCheck,  cls: 'bg-[var(--ok-bg)] text-[var(--ok)] border-[var(--bd)]' },
  ABSENT:  { label: 'Absent',  icon: UserX,      cls: 'bg-[var(--err-bg)] text-[var(--err)] border-red-200' },
  RETARD:  { label: 'Retard',  icon: Clock,      cls: 'bg-[var(--warn-bg)] text-[var(--warn)] border-amber-200' },
};

export default function StudentAttendancePage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [filter, setFilter] = useState<'ALL'|'ABSENT'|'RETARD'>('ALL');

  const { data: profileData } = useQuery(MY_STUDENT_PROFILE_QUERY, {
    variables: { schoolId }, skip: !schoolId,
  });
  const studentId = profileData?.myStudentProfile?.id;

  const { data, loading } = useQuery(MY_ATTENDANCE_QUERY, {
    variables: {
      filter: {
        studentId,
        ...(filter !== 'ALL' ? { statut: filter } : {}),
      },
      pagination: { page: 1, limit: 100 },
    },
    skip: !studentId,
  });

  const records = data?.attendanceByStudent?.data ?? [];
  const total   = data?.attendanceByStudent?.pageInfo?.totalCount ?? 0;

  const presentCount = records.filter((r: any) => r.statut === 'PRESENT').length;
  const absentCount  = records.filter((r: any) => r.statut === 'ABSENT').length;
  const retardCount  = records.filter((r: any) => r.statut === 'RETARD').length;
  const presenceRate = total > 0 ? Math.round((presentCount / records.length) * 100) : null;

  // Regrouper par mois
  const byMonth: Record<string, any[]> = {};
  for (const r of records) {
    const monthKey = new Date(r.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(r);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Mes Présences</h1>
        <p className="text-[var(--tx-muted)] text-sm mt-0.5">{records.length} enregistrements</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center py-4">
          {presenceRate !== null ? (
            <>
              <p className={`text-3xl font-black ${presenceRate >= 80 ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}`}>
                {presenceRate}%
              </p>
              <p className="text-xs text-[var(--tx-muted)] mt-1">Taux de présence</p>
            </>
          ) : (
            <p className="text-[var(--tx-muted)] text-sm">—</p>
          )}
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-black text-[var(--ok)]">{presentCount}</p>
          <p className="text-xs text-[var(--tx-muted)] mt-1">Présent(e)</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-black text-[var(--err)]">{absentCount}</p>
          <p className="text-xs text-[var(--tx-muted)] mt-1">Absent(e)</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-black text-[var(--warn)]">{retardCount}</p>
          <p className="text-xs text-[var(--tx-muted)] mt-1">Retards</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(['ALL', 'ABSENT', 'RETARD'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
              ${filter === f ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-card)] border border-[var(--bd)] text-[var(--tx-secondary)] hover:border-indigo-300'}`}
          >
            {f === 'ALL' ? 'Tout' : f === 'ABSENT' ? 'Absences' : 'Retards'}
          </button>
        ))}
      </div>

      {/* Liste par mois */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-[var(--tx-muted)]">
          <CheckCircle size={36} className="mb-3 text-emerald-400" />
          <p className="font-medium">Aucune absence enregistrée</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byMonth).map(([month, recs]) => (
            <div key={month}>
              <h3 className="font-semibold text-[var(--tx-secondary)] mb-2 capitalize text-sm">{month}</h3>
              <div className="card p-0 overflow-hidden">
                {recs.map((r: any, i: number) => {
                  const cfg   = STATUT_CONFIG[r.statut as keyof typeof STATUT_CONFIG];
                  const Icon  = cfg.icon;
                  return (
                    <div key={r.id}
                      className={`flex items-center gap-4 px-4 py-3
                        ${i < recs.length - 1 ? 'border-b border-[var(--bd)]' : ''}`}>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                      text-xs font-semibold border w-24 flex-shrink-0 ${cfg.cls}`}>
                        <Icon size={12} /> {cfg.label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--tx-primary)]">
                          {r.classSubject?.subject?.nom ?? 'Cours'}
                        </p>
                        {r.motif && (
                          <p className="text-xs text-[var(--tx-muted)]">Motif : {r.motif}</p>
                        )}
                      </div>
                      <span className="text-xs text-[var(--tx-muted)] flex-shrink-0">
                        {new Date(r.date).toLocaleDateString('fr-FR', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
