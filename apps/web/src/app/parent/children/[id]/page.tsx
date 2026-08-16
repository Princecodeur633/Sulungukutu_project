'use client';
import { BulletinDownloadButton } from '@/components/ui/BulletinDownloadButton';
import { PayMonthModal } from '@/components/ui/PayMonthModal';

import { BULLETINS_BY_STUDENT_QUERY, CHILD_SUMMARY_QUERY, MY_SCHOOL_QUERY, BULLETIN_STATUS_CHANGED_SUBSCRIPTION, PAYMENTS_BY_STUDENT_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { useParams } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useQuery, useSubscription } from '@apollo/client';
import Link from 'next/link';
import {
  ChevronLeft, TrendingUp, UserCheck, CreditCard, FileText,
  Download, Lock, AlertTriangle, CheckCircle, BarChart2,
  Calendar, BookOpen, TrendingDown, Smartphone,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';

const MOIS_LABELS = ['','Sep','Oct','Nov','Déc','Jan','Fév','Mar','Avr','Mai'];
const MENTION_LABELS: Record<string, string> = {
  EXCELLENT:'Excellent', TRES_BIEN:'Très Bien', BIEN:'Bien',
  ASSEZ_BIEN:'Assez Bien', PASSABLE:'Passable', INSUFFISANT:'Insuffisant',
};
const MENTION_COLORS: Record<string, string> = {
  EXCELLENT:'text-[var(--ok)]', TRES_BIEN:'text-[var(--ok)]', BIEN:'text-lime-600',
  ASSEZ_BIEN:'text-yellow-600', PASSABLE:'text-[var(--warn)]', INSUFFISANT:'text-[var(--err)]',
};
const TABS = ['Résumé', 'Notes', 'Présences', 'Bulletins', 'Paiements'] as const;
const TRIMESTRES = ['T1', 'T2', 'T3'] as const;

function GradeColor({ v }: { v: number }) {
  const cls = v >= 14 ? 'text-[var(--ok)]' : v >= 10 ? 'text-[var(--warn)]' : 'text-[var(--err)]';
  return <span className={`font-bold text-sm ${cls}`}>{v.toFixed(2)}/20</span>;
}

export default function ChildDetailPage() {
  const params     = useParams();
  const studentId  = params.id as string;
  const schoolId   = tokenStorage.getSchoolId() ?? '';
  const { data: mySchoolData } = useQuery(MY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  const annee      = mySchoolData?.mySchool?.anneeScolaire ?? '2024-2025';
  const [tab, setTab]         = useState<typeof TABS[number]>('Résumé');
  const [trimFilter, setTrim] = useState<string>('T1');
  const [bulletinView, setBulletinView] = useState<'cards'|'compare'>('cards');
  const [payingMonth, setPayingMonth] = useState<number | null>(null);

  const { data, loading, refetch: refetchSummary } = useQuery(CHILD_SUMMARY_QUERY, { variables: { studentId }, skip: !studentId });
  const { data: paymentsData, refetch: refetchPayments } = useQuery(PAYMENTS_BY_STUDENT_QUERY, {
    variables: { studentId, anneeScolaire: annee }, skip: !studentId,
  });
  const { data: bulletinData, refetch: refetchBulletins } = useQuery(BULLETINS_BY_STUDENT_QUERY, {
    variables: { studentId, anneeScolaire: annee }, skip: !studentId,
  });

  // Temps réel : le parent voit apparaître le bulletin dès sa publication,
  // sans avoir à recharger la page.
  useSubscription(BULLETIN_STATUS_CHANGED_SUBSCRIPTION, {
    variables: { studentId },
    skip: !studentId,
    onData: () => refetchBulletins(),
  });

  const summary   = data?.childSummary;
  const student   = summary?.student;
  const profile   = student?.membership?.profile;
  const bulletins = bulletinData?.bulletinsByStudent ?? [];

  // ── Notes : grouper par trimestre → matière
  const gradesByTrim = useMemo(() => {
    const all = summary?.allGrades ?? [];
    const byTrim: Record<string, Record<string, any[]>> = {};
    for (const g of all) {
      const t   = g.trimestre ?? 'T1';
      const nom = g.classSubject?.subject?.nom ?? 'Inconnue';
      byTrim[t] ??= {};
      byTrim[t][nom] ??= [];
      byTrim[t][nom].push(g);
    }
    return byTrim;
  }, [summary?.allGrades]);

  // ── Progression par matière (graphique T1→T3)
  const progressionChart = useMemo(() => {
    const allGrades = summary?.allGrades ?? [];
    const subjects = new Set(allGrades.map((g: any) => g.classSubject?.subject?.nom).filter(Boolean));
    return Array.from(subjects).map((nom) => {
      const moyTrim = (t: string) => {
        const vals = allGrades
          .filter((g: any) => g.trimestre === t && g.classSubject?.subject?.nom === nom)
          .map((g: any) => parseFloat(g.valeur));
        return vals.length ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2) : undefined;
      };
      const label = (nom as string).length > 10 ? (nom as string).slice(0, 9) + '…' : nom;
      return { matiere: label, T1: moyTrim('T1'), T2: moyTrim('T2'), T3: moyTrim('T3') };
    });
  }, [summary?.allGrades]);

  // ── Présences : grouper par mois
  const attendStats = useMemo(() => {
    const all = summary?.allAttendances ?? [];
    const total   = all.length;
    const present = all.filter((a: any) => a.statut === 'PRESENT').length;
    const absent  = all.filter((a: any) => a.statut === 'ABSENT').length;
    const retard  = all.filter((a: any) => a.statut === 'RETARD').length;
    return { total, present, absent, retard, pct: total > 0 ? Math.round(present/total*100) : 0 };
  }, [summary?.allAttendances]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );
  if (!summary) return <div className="text-center py-16 text-[var(--tx-muted)]">Élève introuvable</div>;

  const avg   = summary.moyenneGenerale  ? parseFloat(summary.moyenneGenerale).toFixed(2) : null;
  const pct   = summary.presenceRate ? Math.round(summary.presenceRate * 100) : null;
  const unpaid = summary.unpaidMonths?.length ?? 0;

  return (
    <div className="space-y-5">

      {/* Retour */}
      <Link href="/parent/children" className="inline-flex items-center gap-1.5 text-sm text-[var(--tx-muted)] hover:text-purple-600 transition-colors">
        <ChevronLeft size={16} /> Mes enfants
      </Link>

      {/* Header élève */}
      <div className="card">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center
                          text-purple-700 font-black text-2xl flex-shrink-0">
            {profile?.prenom?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--tx-primary)]">{profile?.prenom} {profile?.nom}</h1>
            <p className="text-[var(--tx-muted)] text-sm mt-0.5">
              {student?.class?.nom}
              {student?.class?.level?.nom && ` · ${student.class.level.nom}`}
              {student?.matricule && ` · Matr. ${student.matricule}`}
            </p>
          </div>
          <div className="flex gap-6 flex-shrink-0">
            <div className="text-center">
              <p className={`text-3xl font-black ${avg ? (parseFloat(avg) >= 10 ? 'text-[var(--ok)]' : 'text-[var(--err)]') : 'text-[var(--tx-muted)]'}`}>
                {avg ?? '—'}
              </p>
              <p className="text-xs text-[var(--tx-muted)] mt-0.5">Moy. générale</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-black ${pct !== null ? (pct >= 80 ? 'text-[var(--ok)]' : 'text-[var(--warn)]') : 'text-[var(--tx-muted)]'}`}>
                {pct !== null ? `${pct}%` : '—'}
              </p>
              <p className="text-xs text-[var(--tx-muted)] mt-0.5">Présence</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-black ${unpaid === 0 ? 'text-[var(--ok)]' : 'text-[var(--err)]'}`}>
                {unpaid}
              </p>
              <p className="text-xs text-[var(--tx-muted)] mt-0.5">Impayé(s)</p>
            </div>
          </div>
        </div>

        {/* Alerte impayés */}
        {unpaid > 0 && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-[var(--err-bg)] border border-[var(--bd)] rounded-xl">
            <AlertTriangle size={16} className="text-[var(--err)] flex-shrink-0" />
            <p className="text-sm text-[var(--err)]">
              <span className="font-semibold">{unpaid} mensualité(s) impayée(s) :</span>{' '}
              {summary.unpaidMonths.map((p: any) => MOIS_LABELS[p.mois]).join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-[var(--bg-subtle)]/80 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === t ? 'bg-[var(--bg-card)] text-[var(--tx-primary)] shadow-sm' : 'text-[var(--tx-muted)] hover:text-[var(--tx-secondary)]'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Résumé ── */}
      {tab === 'Résumé' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card">
            <h3 className="section-title"><TrendingUp size={16} className="text-[var(--tx-secondary)]" /> Notes récentes</h3>
            {(summary.recentGrades ?? []).length === 0
              ? <p className="text-sm text-[var(--tx-muted)] py-4 text-center">Aucune note</p>
              : (summary.recentGrades ?? []).map((g: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-[var(--tx-primary)]">{g.classSubject?.subject?.nom}</p>
                    <p className="text-xs text-[var(--tx-muted)]">{g.typeEval} · {g.trimestre}</p>
                  </div>
                  <GradeColor v={parseFloat(g.valeur)} />
                </div>
              ))
            }
          </div>
          <div className="card">
            <h3 className="section-title"><UserCheck size={16} className="text-[var(--err)]" /> Absences récentes</h3>
            {(summary.recentAbsences ?? []).length === 0
              ? <p className="text-sm text-[var(--ok)] flex items-center gap-1.5 py-4"><CheckCircle size={14} /> Aucune absence</p>
              : (summary.recentAbsences ?? []).map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-[var(--tx-primary)]">{a.classSubject?.subject?.nom ?? 'Cours'}</p>
                    <p className="text-xs text-[var(--tx-muted)]">{a.motif || 'Non justifiée'}</p>
                  </div>
                  <span className="text-xs text-[var(--tx-muted)]">
                    {new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      {tab === 'Notes' && (
        <div className="space-y-4">

          {/* Graphique progression T1→T3 */}
          {progressionChart.length > 0 && (
            <div className="card">
              <h3 className="section-title mb-4">
                <BarChart2 size={16} className="text-[var(--tx-secondary)]" /> Progression par matière
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={progressionChart} barSize={10} barCategoryGap="20%">
                  <defs>
                    <linearGradient id="pcGradT1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ddd6fe" /><stop offset="100%" stopColor="#c4b5fd" />
                    </linearGradient>
                    <linearGradient id="pcGradT2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="pcGradT3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#6d28d9" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                  <XAxis dataKey="matiere" tick={{ fontSize: 10, fill: 'var(--tx-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 20]} hide />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--bd)', boxShadow: '0 8px 24px -6px rgba(0,0,0,.18)', fontSize: 12, padding: '8px 12px' }}
                    labelStyle={{ color: 'var(--tx-primary)', fontWeight: 600 }}
                    cursor={{ fill: 'var(--bg-subtle)' }}
                    formatter={(v: any) => [`${v}/20`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: 'var(--tx-muted)' }} />
                  <Bar dataKey="T1" fill="url(#pcGradT1)" name="T1" radius={[3,3,0,0]} isAnimationActive animationDuration={700} />
                  <Bar dataKey="T2" fill="url(#pcGradT2)" name="T2" radius={[3,3,0,0]} isAnimationActive animationDuration={700} />
                  <Bar dataKey="T3" fill="url(#pcGradT3)" name="T3" radius={[3,3,0,0]} isAnimationActive animationDuration={700} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Sélecteur trimestre */}
          <div className="flex gap-2">
            {TRIMESTRES.map((t) => (
              <button key={t} onClick={() => setTrim(t)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all
                  ${trimFilter === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-[var(--bg-card)] border-[var(--bd)] text-[var(--tx-secondary)] hover:border-indigo-300'}`}>
                {t}
              </button>
            ))}
          </div>

          {!gradesByTrim[trimFilter] || Object.keys(gradesByTrim[trimFilter] ?? {}).length === 0 ? (
            <div className="card empty-state">
              <BookOpen size={40} className="empty-state-icon" />
              <p className="font-semibold text-[var(--tx-muted)]">Aucune note pour le {trimFilter}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(gradesByTrim[trimFilter] ?? {}).map(([matiere, grades]) => {
                const vals = (grades as any[]).map((g: any) => parseFloat(g.valeur));
                const moy  = vals.reduce((a, b) => a + b, 0) / vals.length;
                const coef = (grades as any[])[0]?.classSubject?.coefficient ?? 1;
                return (
                  <div key={matiere} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-[var(--tx-primary)]">{matiere}</p>
                        <p className="text-xs text-[var(--tx-muted)]">Coef. {coef} · {(grades as any[]).length} note(s)</p>
                      </div>
                      <div className="text-right">
                        <GradeColor v={moy} />
                        <p className="text-xs text-[var(--tx-muted)] mt-0.5">Moyenne</p>
                      </div>
                    </div>
                    {/* Barre de progression */}
                    <div className="h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden mb-3">
                      <div className={`h-full rounded-full transition-all
                        ${moy >= 14 ? 'bg-[var(--ok)]' : moy >= 10 ? 'bg-[var(--warn)]' : 'bg-[var(--err)]'}`}
                        style={{ width: `${(moy/20)*100}%` }} />
                    </div>
                    {/* Détail des notes */}
                    <div className="flex flex-wrap gap-2">
                      {(grades as any[]).map((g: any, i: number) => {
                        const v = parseFloat(g.valeur);
                        const color = v >= 14 ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : v >= 10 ? 'bg-[var(--warn-bg)] text-[var(--warn)]' : 'bg-[var(--err-bg)] text-[var(--err)]';
                        return (
                          <div key={i} className={`px-3 py-1.5 rounded-lg text-xs ${color}`}>
                            <span className="font-bold">{v.toFixed(1)}</span>
                            <span className="opacity-70 ml-1">{g.typeEval}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Présences ── */}
      {tab === 'Présences' && (
        <div className="space-y-4">
          {/* Stats globales */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Présences', value: attendStats.present, color: 'bg-[var(--ok-bg)] text-[var(--ok)]', icon: '✓' },
              { label: 'Absences',  value: attendStats.absent,  color: 'bg-[var(--err-bg)] text-[var(--err)]',         icon: '✗' },
              { label: 'Retards',   value: attendStats.retard,  color: 'bg-[var(--warn-bg)] text-[var(--warn)]',     icon: '⏱' },
              { label: 'Taux',      value: `${attendStats.pct}%`, color: attendStats.pct >= 80 ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-orange-100 text-orange-700', icon: '📊' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="card text-center py-4">
                <p className="text-2xl mb-0.5">{icon}</p>
                <p className={`text-2xl font-black mt-1 ${color.split(' ')[1]}`}>{value}</p>
                <p className="text-xs text-[var(--tx-muted)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Liste des absences */}
          <div className="card">
            <h3 className="section-title"><AlertTriangle size={15} className="text-[var(--err)]" /> Absences enregistrées</h3>
            {attendStats.absent === 0 ? (
              <div className="flex items-center gap-2 text-[var(--ok)] py-6 justify-center">
                <CheckCircle size={18} /> <span className="font-semibold">Aucune absence cette année !</span>
              </div>
            ) : (
              <div className="space-y-2">
                {(summary.allAttendances ?? []).filter((a: any) => a.statut !== 'PRESENT').map((a: any, i: number) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border
                    ${a.statut === 'ABSENT' ? 'bg-[var(--err-bg)] border-[var(--bd)]' : 'bg-[var(--warn-bg)] border-[var(--bd)]'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`badge ${a.statut === 'ABSENT' ? 'badge-danger' : 'badge-warning'}`}>
                        {a.statut === 'ABSENT' ? 'Absent' : 'Retard'}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--tx-primary)]">{a.classSubject?.subject?.nom ?? 'Cours'}</p>
                        <p className="text-xs text-[var(--tx-muted)]">{a.motif || 'Non justifiée'}</p>
                      </div>
                    </div>
                    <span className="text-sm text-[var(--tx-secondary)] font-medium flex-shrink-0">
                      {new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bulletins ── */}
      {tab === 'Bulletins' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {bulletins.filter((b: any) => b.statut === 'PUBLIE').length >= 2 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 10, padding: 3, gap: 2 }}>
                {(['cards', 'compare'] as const).map(v => (
                  <button key={v} onClick={() => setBulletinView(v)}
                    style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: bulletinView === v ? 'var(--bg-card)' : 'transparent',
                      color: bulletinView === v ? 'var(--tx-primary)' : 'var(--tx-muted)',
                      boxShadow: bulletinView === v ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
                    {v === 'cards' ? '📋 Bulletins' : '📊 Comparaison T1/T2/T3'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {bulletinView === 'cards' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
              {(['T1','T2','T3'] as const).map((t) => {
                const b = bulletins.find((b: any) => b.trimestre === t);
                if (!b) return (
                  <div key={t} className="card flex flex-col items-center justify-center py-12 text-[var(--tx-muted)] border-dashed border-2">
                    <FileText size={36} className="mb-3" />
                    <p className="font-semibold">Trimestre {t.slice(1)}</p>
                    <p className="text-xs mt-1">Non généré</p>
                  </div>
                );
                const moy = b.moyenneGenerale ? parseFloat(b.moyenneGenerale) : null;
                const published = b.statut === 'PUBLIE';
                return (
                  <div key={t} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-[var(--tx-secondary)]">Trimestre {t.slice(1)}</h3>
                      <span className={published ? 'badge badge-success' : 'badge badge-neutral'}>{published ? 'Publié' : b.statut}</span>
                    </div>
                    {moy !== null && (
                      <div className="text-center mb-4">
                        <p style={{ fontSize: 36, fontWeight: 900, color: moy >= 14 ? '#16a34a' : moy >= 10 ? '#d97706' : '#dc2626', letterSpacing: '-.04em', lineHeight: 1 }}>{moy.toFixed(2)}</p>
                        <p className="text-xs text-[var(--tx-muted)] mt-1">
                          {b.rang && `Rang ${b.rang} · `}
                          <span className={MENTION_COLORS[b.mention] ?? 'text-[var(--tx-secondary)]'}>{MENTION_LABELS[b.mention] ?? ''}</span>
                        </p>
                      </div>
                    )}
                    <BulletinDownloadButton bulletinId={b.id} pdfUrl={b.pdfUrl} isDownloadable={published && b.isDownloadable} size="md" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' }}>
              {/* Résumé moyennes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid var(--bd)', background: 'var(--bg-subtle)' }}>
                {(['T1','T2','T3'] as const).map((t, i) => {
                  const b = bulletins.find((x: any) => x.trimestre === t);
                  const m = b?.moyenneGenerale ? parseFloat(b.moyenneGenerale) : null;
                  const prevB = i > 0 ? bulletins.find((x: any) => x.trimestre === ['T1','T2','T3'][i-1]) : null;
                  const prevM = prevB?.moyenneGenerale ? parseFloat(prevB.moyenneGenerale) : null;
                  const gColor = (v: number) => v >= 14 ? '#16a34a' : v >= 10 ? '#d97706' : '#dc2626';
                  return (
                    <div key={t} style={{ padding: '16px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--bd)' : undefined }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-muted)', marginBottom: 8 }}>Trimestre {i+1}</p>
                      {m !== null ? (
                        <>
                          <p style={{ fontSize: 26, fontWeight: 900, color: gColor(m), letterSpacing: '-.04em' }}>{m.toFixed(2)}</p>
                          {prevM !== null && (
                            <p style={{ fontSize: 11, fontWeight: 700, color: m-prevM > 0 ? '#16a34a' : m-prevM < 0 ? '#dc2626' : '#94a3b8', marginTop: 2 }}>
                              {m-prevM > 0 ? '+' : ''}{(m-prevM).toFixed(2)}
                            </p>
                          )}
                          {b?.mention && <p style={{ fontSize: 11, marginTop: 4, color: 'var(--tx-secondary)' }}>{MENTION_LABELS[b.mention] ?? ''}</p>}
                        </>
                      ) : <p style={{ color: 'var(--tx-muted)', marginTop: 12 }}>—</p>}
                    </div>
                  );
                })}
              </div>
              {/* Table matières */}
              {(() => {
                const subjectMap = new Map<string, string>();
                bulletins.forEach((b: any) => (b.details ?? []).forEach((d: any) => {
                  if (d.classSubject?.subject?.id) subjectMap.set(d.classSubject.subject.id, d.classSubject.subject.nom);
                }));
                const subjects = Array.from(subjectMap.entries());
                const getM = (trimestre: string, sid: string) => {
                  const b = bulletins.find((x: any) => x.trimestre === trimestre);
                  const d = (b?.details ?? []).find((x: any) => x.classSubject?.subject?.id === sid);
                  return d ? parseFloat(d.moyenneMatiere) : null;
                };
                const gColor = (v: number) => v >= 14 ? '#16a34a' : v >= 10 ? '#d97706' : '#dc2626';
                return (
                  <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)' }}>
                        <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', borderBottom: '1px solid var(--bd)' }}>Matière</th>
                        {['T1','T2','T3'].map(t => <th key={t} style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', borderLeft: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)' }}>T{t.slice(1)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(([id, nom], idx) => (
                        <tr key={id} style={{ borderBottom: '1px solid var(--bd)', background: idx%2===0 ? 'var(--bg-card)' : 'var(--bg-subtle)' }}>
                          <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 500, color: 'var(--tx-primary)' }}>{nom}</td>
                          {['T1','T2','T3'].map((t, i) => {
                            const v = getM(t, id);
                            return (
                              <td key={i} style={{ borderLeft: '1px solid var(--bd)', padding: '8px 12px', textAlign: 'center' }}>
                                {v !== null ? <span style={{ fontSize: 13, fontWeight: 800, color: gColor(v), fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(2)}</span> : <span style={{ color: 'var(--tx-muted)' }}>—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Paiements ── */}
      {tab === 'Paiements' && (
        <div className="card">
          <h3 className="section-title"><CreditCard size={16} className="text-[var(--warn)]" /> Paiements {annee}</h3>
          <div className="grid grid-cols-3 md:grid-cols-9 gap-2.5">
            {[1,2,3,4,5,6,7,8,9].map((mois) => {
              const p    = (paymentsData?.paymentsByStudent?.moisDetails ?? []).find((x: any) => x.mois === mois);
              const paid = p?.statut === 'PAYE' || p?.statut === 'EXONERE';
              const partiel = p?.statut === 'PARTIEL';
              const restant = p ? Math.max(0, (p.montantDu ?? 0) - (p.montantPaye ?? 0)) : 0;
              return (
                <div key={mois}
                  className={`text-center p-3.5 rounded-xl border
                    ${paid ? 'bg-[var(--ok-bg)] border-[var(--bd)]' : partiel ? 'bg-[var(--warn-bg)] border-amber-200' : 'bg-[var(--err-bg)] border-red-200'}`}>
                  <p className="text-xs font-bold text-[var(--tx-secondary)]">{MOIS_LABELS[mois]}</p>
                  <div className="mt-2">
                    {paid
                      ? <CheckCircle size={18} className="text-[var(--ok)] mx-auto" />
                      : <AlertTriangle size={18} className="text-[var(--err)] mx-auto" />}
                  </div>
                  {paid && p?.recuUrl && (
                    <button
                      onClick={() => window.open(`${p.recuUrl}?token=${tokenStorage.get()}`, '_blank')}
                      title="Télécharger le reçu"
                      className="mt-1 text-[var(--tx-muted)] hover:text-[var(--tx-primary)] transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                    >
                      <Download size={11} />
                    </button>
                  )}
                  {!paid && (
                    <button
                      onClick={() => setPayingMonth(mois)}
                      title="Payer ce mois via Mobile Money"
                      className="mt-1.5 inline-flex items-center gap-1"
                      style={{
                        background: 'var(--warn)', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Smartphone size={11} /> Payer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 12 }}>
            Paiement Mobile Money simulé — les identifiants réels d'un opérateur ne sont pas requis pour cette démonstration.
          </p>
        </div>
      )}

      <PayMonthModal
        isOpen={payingMonth !== null}
        studentId={studentId}
        mois={payingMonth ?? 0}
        anneeScolaire={annee}
        montantDu={(() => {
          const p = (paymentsData?.paymentsByStudent?.moisDetails ?? []).find((x: any) => x.mois === payingMonth);
          return p ? Math.max(0, Number(p.montantDu ?? 0) - Number(p.montantPaye ?? 0)) : 0;
        })()}
        onClose={() => setPayingMonth(null)}
        onSuccess={() => { refetchSummary(); refetchPayments(); }}
      />
    </div>
  );
}
