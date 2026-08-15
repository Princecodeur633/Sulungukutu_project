'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import {
  CLASSES_BY_SCHOOL_QUERY,
  CLASS_SUBJECTS_WITH_GRADES_QUERY,
} from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import {
  TrendingUp, ChevronDown, ChevronUp, BookOpen,
  Users, Award, AlertTriangle,
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────
const TRIMESTRES = ['T1', 'T2', 'T3'] as const;
type Trimestre = typeof TRIMESTRES[number];

const EVAL_TYPES = ['DEVOIR', 'CONTROLE', 'EXAMEN', 'INTERRO'] as const;

const MENTION = (avg: number) => {
  if (avg >= 16) return { label: 'Excellent',   cls: 'text-[var(--ok)] bg-[var(--ok-bg)]' };
  if (avg >= 14) return { label: 'Très bien',   cls: 'text-[var(--ok)] bg-[var(--ok-bg)]' };
  if (avg >= 12) return { label: 'Bien',        cls: 'text-lime-600 bg-lime-50' };
  if (avg >= 10) return { label: 'Passable',    cls: 'text-[var(--warn)] bg-[var(--warn-bg)]' };
  return              { label: 'Insuffisant',   cls: 'text-[var(--err)] bg-[var(--err-bg)]' };
};

const fmt = (v: number) => v.toFixed(2);

// ── Calcul moyenne ────────────────────────────────────────────
function calcMoyenne(grades: any[]): number | null {
  if (!grades.length) return null;
  const sum = grades.reduce((acc, g) => acc + parseFloat(g.valeur), 0);
  return sum / grades.length;
}

// ── Composant tableau de notes par matière ────────────────────
function SubjectGradesTable({
  cs,
  trimestre,
  evalFilter,
  students,
}: {
  cs: any;
  trimestre: Trimestre;
  evalFilter: string;
  students: { id: string; nom: string; prenom: string; matricule: string }[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Filtrer les notes par trimestre + type eval
  const filteredGrades = (cs.grades ?? []).filter((g: any) => {
    const matchTrimestre = g.trimestre === trimestre;
    const matchType      = !evalFilter || g.typeEval === evalFilter;
    return matchTrimestre && matchType;
  });

  // Construire la matrice élève → notes
  const gradesByStudent = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const g of filteredGrades) {
      const sid = g.student?.id;
      if (!sid) continue;
      if (!map[sid]) map[sid] = [];
      map[sid].push(parseFloat(g.valeur));
    }
    return map;
  }, [filteredGrades]);

  // Stats globales
  const allAverages = students
    .map((s) => {
      const notes = gradesByStudent[s.id];
      if (!notes?.length) return null;
      return notes.reduce((a, b) => a + b, 0) / notes.length;
    })
    .filter((v) => v !== null) as number[];

  const classMoyenne = allAverages.length
    ? allAverages.reduce((a, b) => a + b, 0) / allAverages.length
    : null;
  const failCount = allAverages.filter((v) => v < 10).length;

  return (
    <div className="card overflow-hidden">
      {/* En-tête matière */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-subtle)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
            <BookOpen size={16} className="text-[var(--tx-secondary)]" />
          </div>
          <div className="text-left">
            <p className="font-bold text-[var(--tx-primary)]">{cs.subject?.nom}</p>
            <p className="text-xs text-[var(--tx-muted)]">
              Coef. {cs.coefficient} ·{' '}
              {cs.teacher?.profile?.prenom} {cs.teacher?.profile?.nom} ·{' '}
              {filteredGrades.length} note(s)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {classMoyenne !== null ? (
            <>
              <div className="text-right">
                <p className="text-xl font-bold text-[var(--tx-primary)]">{fmt(classMoyenne)}<span className="text-sm text-[var(--tx-muted)]">/20</span></p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MENTION(classMoyenne).cls}`}>
                  {MENTION(classMoyenne).label}
                </span>
              </div>
              {failCount > 0 && (
                <div className="flex items-center gap-1 text-[var(--err)] text-xs font-semibold">
                  <AlertTriangle size={13} />
                  {failCount} en échec
                </div>
              )}
            </>
          ) : (
            <span className="text-sm text-[var(--tx-muted)] italic">Aucune note</span>
          )}
          {collapsed ? <ChevronDown size={16} className="text-[var(--tx-muted)]" /> : <ChevronUp size={16} className="text-[var(--tx-muted)]" />}
        </div>
      </button>

      {/* Tableau élèves */}
      {!collapsed && (
        <div className="overflow-x-auto border-t border-[var(--bd)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-subtle)]">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--tx-muted)] w-48">Élève</th>
                {EVAL_TYPES.filter((et) => !evalFilter || et === evalFilter).map((et) => (
                  <th key={et} className="text-center px-3 py-2.5 text-xs font-semibold text-[var(--tx-muted)] min-w-[90px]">
                    {et}
                  </th>
                ))}
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-[var(--tx-secondary)] min-w-[90px]">Moyenne</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((student, i) => {
                const studentGrades = filteredGrades.filter((g: any) => g.student?.id === student.id);
                const byType: Record<string, number[]> = {};
                for (const g of studentGrades) {
                  if (!byType[g.typeEval]) byType[g.typeEval] = [];
                  byType[g.typeEval].push(parseFloat(g.valeur));
                }
                const avg = calcMoyenne(studentGrades.map((g: any) => ({ valeur: g.valeur })));
                const mention = avg !== null ? MENTION(avg) : null;

                return (
                  <tr key={student.id} className={`hover:bg-[var(--bg-subtle)] transition-colors ${i % 2 === 0 ? '' : 'bg-[var(--bg-subtle)]/40'}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--info-bg)] flex items-center justify-center
                                        text-[var(--tx-primary)] text-xs font-bold flex-shrink-0">
                          {student.prenom?.[0] ?? '?'}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--tx-primary)] text-xs">{student.prenom} {student.nom}</p>
                          <p className="text-xs text-[var(--tx-muted)] font-mono">{student.matricule}</p>
                        </div>
                      </div>
                    </td>
                    {EVAL_TYPES.filter((et) => !evalFilter || et === evalFilter).map((et) => {
                      const notes = byType[et] ?? [];
                      return (
                        <td key={et} className="text-center px-3 py-2.5">
                          {notes.length > 0 ? (
                            <span className="font-semibold text-[var(--tx-primary)]">
                              {notes.map((n) => fmt(n)).join(', ')}
                            </span>
                          ) : (
                            <span className="text-[var(--tx-muted)]">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center px-4 py-2.5">
                      {avg !== null ? (
                        <span className={`font-bold px-2 py-0.5 rounded-md text-xs ${mention!.cls}`}>
                          {fmt(avg)}
                        </span>
                      ) : (
                        <span className="text-[var(--tx-muted)] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-[var(--tx-muted)] text-xs">
                    Aucun élève dans cette classe
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function AdminGradesPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';

  const [classId,    setClassId]    = useState('');
  const [trimestre,  setTrimestre]  = useState<Trimestre>('T1');
  const [evalFilter, setEvalFilter] = useState('');

  // Récupérer les classes
  const { data: classData } = useQuery(CLASSES_BY_SCHOOL_QUERY, {
    variables: { schoolId },
    skip:      !schoolId,
  });

  // Récupérer les matières + notes de la classe sélectionnée
  const { data: csData, loading } = useQuery(CLASS_SUBJECTS_WITH_GRADES_QUERY, {
    variables: { classId },
    skip:      !classId,
  });

  const classes       = classData?.classesBySchool ?? [];
  // Filtrer les grades par trimestre côté client (l'API retourne tous les trimestres)
  const allClassSubjects = csData?.classSubjectsByClass ?? [];
  const classSubjects = allClassSubjects.map((cs: any) => ({
    ...cs,
    grades: trimestre ? (cs.grades ?? []).filter((g: any) => g.trimestre === trimestre) : (cs.grades ?? []),
  }));
  const activeClass   = classes.find((c: any) => c.id === classId);

  // Extraire la liste des élèves depuis les notes
  const students = useMemo(() => {
    const map = new Map<string, { id: string; nom: string; prenom: string; matricule: string }>();
    for (const cs of classSubjects) {
      for (const g of (cs.grades ?? [])) {
        const s = g.student;
        if (s && !map.has(s.id)) {
          map.set(s.id, {
            id:         s.id,
            nom:        s.membership?.profile?.nom     ?? '',
            prenom:     s.membership?.profile?.prenom  ?? '',
            matricule:  s.matricule                    ?? '',
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [classSubjects]);

  // Stats globales classe
  const classStats = useMemo(() => {
    const allGrades = classSubjects.flatMap((cs: any) =>
      (cs.grades ?? []).filter((g: any) => g.trimestre === trimestre)
    );
    if (!allGrades.length) return null;

    const byStudent: Record<string, number[]> = {};
    for (const g of allGrades) {
      const sid = g.student?.id;
      if (!sid) continue;
      if (!byStudent[sid]) byStudent[sid] = [];
      byStudent[sid].push(parseFloat(g.valeur));
    }

    const averages = Object.values(byStudent)
      .map((notes) => notes.reduce((a, b) => a + b, 0) / notes.length);

    if (!averages.length) return null;

    const classMoy = averages.reduce((a, b) => a + b, 0) / averages.length;
    return {
      moyenne:    classMoy,
      nbEleves:   averages.length,
      nbReussie:  averages.filter((v) => v >= 10).length,
      nbEchec:    averages.filter((v) => v < 10).length,
      meilleure:  Math.max(...averages),
      moins:      Math.min(...averages),
    };
  }, [classSubjects, trimestre]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Notes — Supervision</h1>
        <p className="text-[var(--tx-muted)] text-sm mt-0.5">
          Consultez et supervisez les notes saisies par les enseignants
        </p>
      </div>

      {/* Filtres */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Classe */}
          <div className="flex-1 min-w-[200px]">
            <label className="label">Classe *</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— Sélectionner une classe —</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nom} ({c.level?.nom})</option>
              ))}
            </select>
          </div>

          {/* Trimestre */}
          <div>
            <label className="label">Trimestre</label>
            <div className="flex gap-1">
              {TRIMESTRES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTrimestre(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all
                    ${trimestre === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-[var(--bg-card)] border-[var(--bd)] text-[var(--tx-secondary)] hover:border-indigo-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Type éval */}
          <div>
            <label className="label">Type d'évaluation</label>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setEvalFilter('')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all
                  ${!evalFilter ? 'bg-[var(--bg-sidebar)] text-white border-slate-800' : 'bg-[var(--bg-card)] border-[var(--bd)] text-[var(--tx-secondary)]'}`}
              >
                Tous
              </button>
              {EVAL_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setEvalFilter(evalFilter === t ? '' : t)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all
                    ${evalFilter === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-[var(--bg-card)] border-[var(--bd)] text-[var(--tx-secondary)]'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats globales classe */}
      {classStats && activeClass && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-[var(--tx-primary)]">{fmt(classStats.moyenne)}</p>
            <p className="text-xs text-[var(--tx-muted)] mt-0.5">Moyenne classe</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${MENTION(classStats.moyenne).cls}`}>
              {MENTION(classStats.moyenne).label}
            </span>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-[var(--tx-primary)]">{classStats.nbEleves}</p>
            <p className="text-xs text-[var(--tx-muted)] mt-0.5">Élèves notés</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-[var(--ok)]">{classStats.nbReussie}</p>
            <p className="text-xs text-[var(--tx-muted)] mt-0.5">Au-dessus de 10</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-[var(--err)]">{classStats.nbEchec}</p>
            <p className="text-xs text-[var(--tx-muted)] mt-0.5">En dessous de 10</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-lg font-bold text-[var(--tx-primary)]">
              {fmt(classStats.meilleure)} / {fmt(classStats.moins)}
            </p>
            <p className="text-xs text-[var(--tx-muted)] mt-0.5">Meilleures / + basse</p>
          </div>
        </div>
      )}

      {/* État vide */}
      {!classId && (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <TrendingUp size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Sélectionnez une classe</p>
          <p className="text-sm mt-1">pour visualiser les notes par matière</p>
        </div>
      )}

      {/* Loading */}
      {classId && loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Aucune matière */}
      {classId && !loading && classSubjects.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-12 text-[var(--tx-muted)]">
          <BookOpen size={36} className="mb-3 opacity-40" />
          <p className="font-medium">Aucune matière assignée à cette classe</p>
          <p className="text-sm mt-1">Allez dans Classes → gérer pour assigner des matières</p>
        </div>
      )}

      {/* Tableaux par matière */}
      {classId && !loading && classSubjects.length > 0 && (
        <div className="space-y-4">
          {/* Résumé */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[var(--tx-muted)]">
              <Users size={15} />
              <span>
                <strong className="text-[var(--tx-secondary)]">{activeClass?.nom}</strong> ·{' '}
                {classSubjects.length} matière(s) ·{' '}
                {students.length} élève(s) noté(s) · {trimestre}
              </span>
            </div>
            {classStats && (
              <div className="flex items-center gap-1.5 text-sm">
                <Award size={14} className="text-[var(--tx-secondary)]" />
                <span className="font-semibold text-[var(--tx-secondary)]">
                  Moyenne classe : {fmt(classStats.moyenne)}/20
                </span>
              </div>
            )}
          </div>

          {/* Un tableau par matière */}
          {classSubjects.map((cs: any) => (
            <SubjectGradesTable
              key={cs.id}
              cs={cs}
              trimestre={trimestre}
              evalFilter={evalFilter}
              students={students}
            />
          ))}
        </div>
      )}
    </div>
  );
}
