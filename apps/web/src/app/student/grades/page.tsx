'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { MY_GRADES_QUERY, MY_STUDENT_PROFILE_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { TrendingUp, TrendingDown, BarChart2, BookOpen } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell,
} from 'recharts';

const TRIMESTRES = ['T1', 'T2', 'T3'] as const;
const TYPE_BADGE: Record<string, string> = {
  DEVOIR:   'badge-info',    CONTROLE: 'badge-warning',
  EXAMEN:   'badge-danger',  INTERRO:  'badge-neutral',
};
const TYPE_LABEL: Record<string, string> = {
  DEVOIR:'Devoir', CONTROLE:'Contrôle', EXAMEN:'Examen', INTERRO:'Interro',
};

// Calcule la moyenne pondérée d'une liste de notes
function calcMoyenne(grades: any[]): number | null {
  if (!grades.length) return null;
  const total = grades.reduce((acc, g) => acc + parseFloat(g.valeur), 0);
  return total / grades.length;
}

function calcMoyenneGenerale(grades: any[]): number | null {
  if (!grades.length) return null;
  const bySubject: Record<string, { vals: number[]; coef: number }> = {};
  for (const g of grades) {
    const nom  = g.classSubject?.subject?.nom ?? '?';
    const coef = Number(g.classSubject?.coefficient ?? 1);
    bySubject[nom] ??= { vals: [], coef };
    bySubject[nom].vals.push(parseFloat(g.valeur));
  }
  const subs = Object.values(bySubject);
  if (!subs.length) return null;
  const pts  = subs.reduce((a, s) => a + (s.vals.reduce((x, y) => x + y, 0) / s.vals.length) * s.coef, 0);
  const coefs = subs.reduce((a, s) => a + s.coef, 0);
  return coefs > 0 ? pts / coefs : null;
}

function NoteColor({ v }: { v: number }) {
  const cls = v >= 14 ? 'text-[var(--ok)]' : v >= 10 ? 'text-[var(--warn)]' : 'text-[var(--err)]';
  return <span className={`font-bold ${cls}`}>{v.toFixed(2)}/20</span>;
}

function MentionLabel({ v }: { v: number }) {
  if (v >= 16) return <span className="text-[var(--ok)]">Excellent</span>;
  if (v >= 14) return <span className="text-[var(--ok)]">Très Bien</span>;
  if (v >= 12) return <span className="text-lime-600">Bien</span>;
  if (v >= 10) return <span className="text-yellow-600">Assez Bien</span>;
  if (v >= 8)  return <span className="text-orange-500">Passable</span>;
  return <span className="text-[var(--err)]">Insuffisant</span>;
}

export default function StudentGradesPage() {
  const schoolId   = tokenStorage.getSchoolId() ?? '';
  const [trimestre, setTrimestre] = useState<typeof TRIMESTRES[number]>('T1');

  const { data: profileData } = useQuery(MY_STUDENT_PROFILE_QUERY, {
    variables: { schoolId }, skip: !schoolId,
  });
  const studentId = profileData?.myStudentProfile?.id;

  // 3 queries en parallèle pour la progression
  const { data: dataT1 } = useQuery(MY_GRADES_QUERY, {
    variables: { filter: { studentId, trimestre: 'T1' }, pagination: { page: 1, limit: 200 } },
    skip: !studentId,
  });
  const { data: dataT2 } = useQuery(MY_GRADES_QUERY, {
    variables: { filter: { studentId, trimestre: 'T2' }, pagination: { page: 1, limit: 200 } },
    skip: !studentId,
  });
  const { data: dataT3 } = useQuery(MY_GRADES_QUERY, {
    variables: { filter: { studentId, trimestre: 'T3' }, pagination: { page: 1, limit: 200 } },
    skip: !studentId,
  });

  const gradesT1 = dataT1?.gradesByStudent?.data ?? [];
  const gradesT2 = dataT2?.gradesByStudent?.data ?? [];
  const gradesT3 = dataT3?.gradesByStudent?.data ?? [];

  const moyT1 = calcMoyenneGenerale(gradesT1);
  const moyT2 = calcMoyenneGenerale(gradesT2);
  const moyT3 = calcMoyenneGenerale(gradesT3);

  // Progression par matière (les 3 trimestres)
  const progressionData = useMemo(() => {
    const subjects = new Set([
      ...gradesT1.map((g: any) => g.classSubject?.subject?.nom),
      ...gradesT2.map((g: any) => g.classSubject?.subject?.nom),
      ...gradesT3.map((g: any) => g.classSubject?.subject?.nom),
    ].filter(Boolean));

    return Array.from(subjects).map((nom) => {
      const m1 = calcMoyenne(gradesT1.filter((g: any) => g.classSubject?.subject?.nom === nom));
      const m2 = calcMoyenne(gradesT2.filter((g: any) => g.classSubject?.subject?.nom === nom));
      const m3 = calcMoyenne(gradesT3.filter((g: any) => g.classSubject?.subject?.nom === nom));
      return {
        matiere: (nom as string).length > 12 ? (nom as string).slice(0, 11) + '…' : nom,
        T1: m1 ? +m1.toFixed(2) : undefined,
        T2: m2 ? +m2.toFixed(2) : undefined,
        T3: m3 ? +m3.toFixed(2) : undefined,
      };
    });
  }, [gradesT1, gradesT2, gradesT3]);

  // Données du trimestre actif
  const gradesCurrent = trimestre === 'T1' ? gradesT1 : trimestre === 'T2' ? gradesT2 : gradesT3;
  const moyCurrent    = trimestre === 'T1' ? moyT1 : trimestre === 'T2' ? moyT2 : moyT3;

  // Grouper par matière
  const bySubject = useMemo(() => {
    const map: Record<string, { name: string; coef: number; grades: any[] }> = {};
    for (const g of gradesCurrent) {
      const nom  = g.classSubject?.subject?.nom ?? '?';
      const coef = Number(g.classSubject?.coefficient ?? 1);
      map[nom] ??= { name: nom, coef, grades: [] };
      map[nom].grades.push(g);
    }
    return Object.values(map).map((s) => {
      const vals = s.grades.map((g) => parseFloat(g.valeur));
      return { ...s, moyenne: vals.length ? vals.reduce((a,b) => a+b,0)/vals.length : null };
    });
  }, [gradesCurrent]);

  // Évolution T précédent → T courant
  const prevMoy = trimestre === 'T2' ? moyT1 : trimestre === 'T3' ? moyT2 : null;
  const evolution = moyCurrent !== null && prevMoy !== null ? moyCurrent - prevMoy : null;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Mes Notes</h1>
          <p className="page-subtitle">{gradesCurrent.length} note(s) ce trimestre</p>
        </div>
        <div className="flex gap-1.5">
          {TRIMESTRES.map((t) => (
            <button key={t} onClick={() => setTrimestre(t)}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all
                ${trimestre === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-[var(--bg-card)] border-[var(--bd)] text-[var(--tx-secondary)] hover:border-indigo-300'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Moyenne générale + évolution */}
      {moyCurrent !== null && (
        <div className="card flex items-center gap-6 py-5">
          <div className="text-center flex-shrink-0">
            <p className={`text-5xl font-black leading-none
              ${moyCurrent >= 14 ? 'text-[var(--ok)]' : moyCurrent >= 10 ? 'text-[var(--warn)]' : 'text-[var(--err)]'}`}>
              {moyCurrent.toFixed(2)}
            </p>
            <p className="text-[var(--tx-muted)] text-sm mt-1">/20 · Moy. générale {trimestre}</p>
          </div>
          <div className="flex-1">
            <div className="h-3 bg-[var(--bg-subtle)] rounded-full overflow-hidden mb-2">
              <div className={`h-full rounded-full transition-all
                ${moyCurrent >= 14 ? 'bg-[var(--ok)]' : moyCurrent >= 10 ? 'bg-[var(--warn)]' : 'bg-[var(--err)]'}`}
                style={{ width: `${(moyCurrent / 20) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--tx-secondary)]">
                <MentionLabel v={moyCurrent} />
              </p>
              {evolution !== null && (
                <p className={`text-sm font-semibold flex items-center gap-1
                  ${evolution >= 0 ? 'text-[var(--ok)]' : 'text-[var(--err)]'}`}>
                  {evolution >= 0
                    ? <TrendingUp size={15} />
                    : <TrendingDown size={15} />}
                  {evolution >= 0 ? '+' : ''}{evolution.toFixed(2)} vs {trimestre === 'T2' ? 'T1' : 'T2'}
                </p>
              )}
            </div>
          </div>
          {/* Résumé 3 trimestres */}
          <div className="flex gap-4 flex-shrink-0 border-l border-[var(--bd)] pl-6">
            {[{ t: 'T1', moy: moyT1 }, { t: 'T2', moy: moyT2 }, { t: 'T3', moy: moyT3 }].map(({ t, moy }) => (
              <div key={t} className="text-center">
                <p className={`text-lg font-black ${moy ? (moy >= 10 ? 'text-[var(--tx-secondary)]' : 'text-red-400') : 'text-[var(--tx-muted)]'}`}>
                  {moy ? moy.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-[var(--tx-muted)]">{t}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graphique progression par matière */}
      {progressionData.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-4">
            <BarChart2 size={16} className="text-[var(--tx-secondary)]" /> Progression par matière (T1 → T3)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={progressionData} barSize={12} barCategoryGap="20%">
              <defs>
                <linearGradient id="gradT1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c7d2fe" /><stop offset="100%" stopColor="#a5b4fc" />
                </linearGradient>
                <linearGradient id="gradT2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="gradT3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#4338ca" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
              <XAxis dataKey="matiere" tick={{ fontSize: 11, fill: 'var(--tx-muted)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 20]} hide />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--bd)', boxShadow: '0 8px 24px -6px rgba(0,0,0,.18)', fontSize: 12, padding: '8px 12px' }}
                labelStyle={{ color: 'var(--tx-primary)', fontWeight: 600 }}
                cursor={{ fill: 'var(--bg-subtle)' }}
                formatter={(v: any) => [`${v}/20`]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, color: 'var(--tx-muted)' }} />
              <Bar dataKey="T1" fill="url(#gradT1)" name="T1" radius={[3,3,0,0]} isAnimationActive animationDuration={700} />
              <Bar dataKey="T2" fill="url(#gradT2)" name="T2" radius={[3,3,0,0]} isAnimationActive animationDuration={700} />
              <Bar dataKey="T3" fill="url(#gradT3)" name="T3" radius={[3,3,0,0]} isAnimationActive animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
          {/* Ligne des 10 */}
          <p className="text-xs text-[var(--tx-muted)] text-center mt-1">La barre de 10/20 est la limite de la moyenne</p>
        </div>
      )}

      {/* Notes détaillées par matière */}
      {gradesCurrent.length === 0 ? (
        <div className="card empty-state py-16">
          <BookOpen size={44} className="empty-state-icon" />
          <p className="font-semibold text-[var(--tx-muted)]">Aucune note pour le {trimestre}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bySubject.map((s) => (
            <div key={s.name} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-[var(--tx-primary)]">{s.name}</p>
                  <p className="text-xs text-[var(--tx-muted)]">
                    Coef. {s.coef} · {s.grades.length} note(s)
                  </p>
                </div>
                {s.moyenne !== null && (
                  <div className="text-right">
                    <NoteColor v={s.moyenne} />
                    <p className="text-xs text-[var(--tx-muted)]">Moyenne</p>
                  </div>
                )}
              </div>
              {/* Barre de progression */}
              <div className="h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all
                    ${s.moyenne! >= 14 ? 'bg-[var(--ok)]' : s.moyenne! >= 10 ? 'bg-[var(--warn)]' : 'bg-[var(--err)]'}`}
                  style={{ width: `${((s.moyenne ?? 0) / 20) * 100}%` }}
                />
              </div>
              {/* Chips des notes */}
              <div className="flex flex-wrap gap-2">
                {s.grades.map((g: any) => {
                  const v   = parseFloat(g.valeur);
                  const cls = v >= 14 ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : v >= 10 ? 'bg-[var(--warn-bg)] text-[var(--warn)]' : 'bg-[var(--err-bg)] text-[var(--err)]';
                  const d   = new Date(g.dateSaisie);
                  return (
                    <div key={g.id} className={`px-3 py-1.5 rounded-xl text-xs ${cls} flex items-center gap-1.5`}>
                      <span className="font-black">{v.toFixed(1)}</span>
                      <span className="opacity-70">{TYPE_LABEL[g.typeEval] ?? g.typeEval}</span>
                      <span className="opacity-50">{d.getDate()}/{d.getMonth()+1}</span>
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
