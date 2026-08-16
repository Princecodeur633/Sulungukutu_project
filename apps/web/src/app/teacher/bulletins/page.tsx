'use client';
import { BulletinDownloadButton } from '@/components/ui/BulletinDownloadButton';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import {
  TEACHER_DASHBOARD_QUERY,
  BULLETINS_BY_CLASS_QUERY,
  MY_SCHOOL_QUERY,
} from '@/lib/graphql/queries';
import {
  FileText, Download, Lock, TrendingUp, Users,
  ChevronDown, Eye,
} from 'lucide-react';

const TRIMESTRES = ['T1', 'T2', 'T3'] as const;

const MENTION_COLORS: Record<string, string> = {
  EXCELLENT:   'text-[var(--ok)]', TRES_BIEN: 'text-[var(--ok)]',
  BIEN:        'text-lime-600',    ASSEZ_BIEN: 'text-yellow-600',
  PASSABLE:    'text-orange-500',  INSUFFISANT: 'text-[var(--err)]',
};
const MENTION_LABELS: Record<string, string> = {
  EXCELLENT:'Excellent', TRES_BIEN:'Très Bien', BIEN:'Bien',
  ASSEZ_BIEN:'Assez Bien', PASSABLE:'Passable', INSUFFISANT:'Insuffisant',
};

export default function TeacherBulletinsPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [selectedClass, setSelectedClass] = useState('');
  const [trimestre, setTrimestre]         = useState<typeof TRIMESTRES[number]>('T1');

  const { data: dashData } = useQuery(TEACHER_DASHBOARD_QUERY, {
    variables: { schoolId }, skip: !schoolId,
  });
  const myClasses = dashData?.teacherDashboard?.myClasses ?? [];

  const { data: mySchoolData } = useQuery(MY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  // Année scolaire réellement configurée pour l'établissement (au lieu d'une
  // constante figée qui n'aurait plus correspondu à l'année en cours).
  const ANNEE = mySchoolData?.mySchool?.anneeScolaire ?? '2024-2025';

  // Sélectionner la première classe par défaut
  const classId = selectedClass || myClasses[0]?.id || '';

  const { data, loading } = useQuery(BULLETINS_BY_CLASS_QUERY, {
    variables: { classId, trimestre, anneeScolaire: ANNEE },
    skip: !classId,
  });
  const bulletins = data?.bulletinsByClass ?? [];

  const published  = bulletins.filter((b: any) => b.statut === 'PUBLIE').length;
  const generated  = bulletins.length;
  const avgGeneral = bulletins.length > 0
    ? bulletins.reduce((acc: number, b: any) => acc + (parseFloat(b.moyenneGenerale) || 0), 0) / bulletins.length
    : null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="page-title">Bulletins</h1>
        <p className="page-subtitle">Consultez les bulletins de vos classes · {ANNEE}</p>
      </div>

      {/* Filtres */}
      <div className="card flex items-center gap-4 py-4">
        <div className="flex-1">
          <label className="label text-xs">Classe</label>
          <div className="relative">
            <select
              className="input pr-8 appearance-none"
              value={classId}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {myClasses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="label text-xs">Trimestre</label>
          <div className="flex gap-1.5">
            {TRIMESTRES.map((t) => (
              <button key={t} onClick={() => setTrimestre(t)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all
                  ${trimestre === t
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-[var(--bg-card)] border-[var(--bd)] text-[var(--tx-secondary)] hover:border-indigo-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      {bulletins.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center py-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--info-bg)] flex items-center justify-center mx-auto mb-2">
              <FileText size={18} className="text-[var(--tx-primary)]" />
            </div>
            <p className="text-2xl font-black text-[var(--tx-primary)]">{generated}</p>
            <p className="text-xs text-[var(--tx-muted)]">Bulletins générés</p>
          </div>
          <div className="card text-center py-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--ok-bg)] flex items-center justify-center mx-auto mb-2">
              <Eye size={18} className="text-[var(--ok)]" />
            </div>
            <p className="text-2xl font-black text-[var(--tx-primary)]">{published}</p>
            <p className="text-xs text-[var(--tx-muted)]">Publiés aux parents</p>
          </div>
          <div className="card text-center py-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-2">
              <TrendingUp size={18} className="text-[var(--tx-secondary)]" />
            </div>
            <p className={`text-2xl font-black ${avgGeneral ? (avgGeneral >= 10 ? 'text-[var(--ok)]' : 'text-[var(--err)]') : 'text-[var(--tx-muted)]'}`}>
              {avgGeneral ? avgGeneral.toFixed(2) : '—'}
            </p>
            <p className="text-xs text-[var(--tx-muted)]">Moy. de classe</p>
          </div>
        </div>
      )}

      {/* Table bulletins */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--bd)] flex items-center justify-between">
          <h3 className="font-bold text-[var(--tx-secondary)] flex items-center gap-2">
            <Users size={16} className="text-[var(--tx-muted)]" />
            {myClasses.find((c: any) => c.id === classId)?.nom ?? 'Classe'} — {trimestre}
          </h3>
          <span className="badge badge-neutral">{bulletins.length} élève(s)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : bulletins.length === 0 ? (
          <div className="empty-state py-16">
            <FileText size={44} className="empty-state-icon" />
            <p className="font-semibold text-[var(--tx-muted)]">Aucun bulletin généré</p>
            <p className="text-xs text-[var(--tx-muted)] mt-1">L'administrateur doit d'abord générer les bulletins</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Élève</th>
                <th className="table-header text-center">Moy. gén.</th>
                <th className="table-header text-center">Rang</th>
                <th className="table-header text-center">Mention</th>
                <th className="table-header text-center">Statut</th>
                <th className="table-header text-center">PDF</th>
              </tr>
            </thead>
            <tbody>
              {bulletins
                .slice()
                .sort((a: any, b: any) => (a.rang ?? 99) - (b.rang ?? 99))
                .map((b: any) => {
                  const profile  = b.student?.membership?.profile;
                  const moy      = b.moyenneGenerale ? parseFloat(b.moyenneGenerale) : null;
                  const published = b.statut === 'PUBLIE';
                  return (
                    <tr key={b.id} className="table-row-hover">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[var(--info-bg)] flex items-center justify-center
                                          text-[var(--tx-primary)] font-bold text-xs flex-shrink-0">
                            {profile?.prenom?.[0] ?? '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--tx-primary)] text-sm">
                              {profile?.prenom} {profile?.nom}
                            </p>
                            <p className="text-xs text-[var(--tx-muted)]">{b.student?.matricule}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        {moy !== null ? (
                          <span className={`font-black text-sm ${moy >= 10 ? 'text-[var(--ok)]' : 'text-[var(--err)]'}`}>
                            {moy.toFixed(2)}
                          </span>
                        ) : <span className="text-[var(--tx-muted)]">—</span>}
                      </td>
                      <td className="table-cell text-center">
                        {b.rang
                          ? <span className="font-semibold text-[var(--tx-secondary)]">{b.rang}e</span>
                          : <span className="text-[var(--tx-muted)]">—</span>}
                      </td>
                      <td className="table-cell text-center">
                        <span className={`text-xs font-semibold ${MENTION_COLORS[b.mention] ?? 'text-[var(--tx-muted)]'}`}>
                          {MENTION_LABELS[b.mention] ?? '—'}
                        </span>
                      </td>
                      <td className="table-cell text-center">
                        <span className={`badge ${published ? 'badge-success' : 'badge-neutral'}`}>
                          {published ? 'Publié' : b.statut ?? 'Brouillon'}
                        </span>
                      </td>
                      <td className="table-cell text-center">
                        {b.statut === 'PUBLIE' ? (
                          <BulletinDownloadButton
                            bulletinId={b.id}
                            pdfUrl={b.pdfUrl}
                            isDownloadable={b.isDownloadable !== false}
                            size="sm"
                            variant="icon"
                          />
                        ) : (
                          <span className="text-[var(--tx-muted)]">
                            <Lock size={14} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
