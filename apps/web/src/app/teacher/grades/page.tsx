'use client';
import { parseGqlError } from '@/lib/errorUtils';
import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { useToast } from '@/components/ui/Toast';
import {
  CLASS_SUBJECTS_BY_TEACHER_QUERY,
  STUDENTS_BY_CLASS_QUERY,
  GRADES_BY_CLASS_QUERY,
  BULK_CREATE_GRADES_MUTATION,
  UPDATE_GRADE_MUTATION,
} from '@/lib/graphql/queries';
import { BookOpen, Save, Download, ChevronDown, Check, AlertCircle, TrendingUp } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────
const TRIMESTERS = ['T1', 'T2', 'T3'] as const;
const EVAL_TYPES = ['DEVOIR', 'CONTROLE', 'EXAMEN', 'INTERRO'] as const;
const TRIMESTER_LABELS: Record<string, string> = { T1: '1er Trimestre', T2: '2ème Trimestre', T3: '3ème Trimestre' };

function gradeColor(v: number | null): string {
  if (v === null) return 'transparent';
  if (v >= 16)  return 'var(--grade-5-bg)';
  if (v >= 12)  return 'var(--grade-4-bg)';
  if (v >= 10)  return 'var(--grade-3-bg)';
  if (v >= 8)   return 'var(--grade-2-bg)';
  return 'var(--grade-1-bg)';
}
function gradeTextColor(v: number | null): string {
  if (v === null) return 'var(--tx-muted)';
  if (v >= 16)  return '#15803d';
  if (v >= 12)  return '#166534';
  if (v >= 10)  return '#854d0e';
  if (v >= 8)   return '#9a3412';
  return '#7f1d1d';
}

function getMention(avg: number | null): { label: string; color: string } {
  if (avg === null) return { label: '—', color: 'var(--tx-muted)' };
  if (avg >= 16) return { label: 'Excellent', color: '#16a34a' };
  if (avg >= 14) return { label: 'Très Bien', color: '#2563eb' };
  if (avg >= 12) return { label: 'Bien', color: '#0891b2' };
  if (avg >= 10) return { label: 'Assez Bien', color: '#d97706' };
  if (avg >= 8)  return { label: 'Passable', color: '#ea580c' };
  return { label: 'Insuffisant', color: '#dc2626' };
}

// ── Cell Component ────────────────────────────────────────────
function GradeCell({
  value, onChange, onBlur, disabled,
}: {
  value: string; onChange: (v: string) => void; onBlur: () => void; disabled?: boolean;
}) {
  const num = value !== '' ? parseFloat(value) : null;
  return (
    <input
      type="number"
      min="0" max="20" step="0.5"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      style={{
        width: '100%', height: '100%', minHeight: 34,
        border: 'none', outline: 'none',
        background: gradeColor(num),
        color: gradeTextColor(num),
        textAlign: 'center', fontWeight: 700, fontSize: 13,
        cursor: disabled ? 'default' : 'text',
        borderRadius: 0,
        padding: '0 2px',
        fontVariantNumeric: 'tabular-nums',
      }}
      className="focus:ring-2 focus:ring-indigo-400 focus:ring-inset"
      placeholder="—"
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TeacherGradesPage() {
  const { addToast }  = useToast();
  const schoolId      = tokenStorage.getSchoolId() ?? '';

  const [classId,    setClassId]    = useState('');
  const [trimestre,  setTrimestre]  = useState<'T1'|'T2'|'T3'>('T1');
  const [typeEval,   setTypeEval]   = useState<typeof EVAL_TYPES[number]>('DEVOIR');
  const [pendingEdits, setPending]  = useState<Record<string, string>>({}); // gradeId → new value
  const [newGrades,  setNewGrades]  = useState<Record<string, Record<string, string>>>({}); // subjectId → studentId → value
  const [saving,     setSaving]     = useState(false);
  const [exporting,  setExporting]  = useState(false);

  // ── Data fetching ─────────────────────────────────────────
  const { data: csData }      = useQuery(CLASS_SUBJECTS_BY_TEACHER_QUERY, { variables: { schoolId }, skip: !schoolId });
  const { data: studentData } = useQuery(STUDENTS_BY_CLASS_QUERY, { variables: { classId }, skip: !classId });
  const students: any[] = studentData?.studentsByClass?.data ?? [];
  const { data: gradeData, refetch } = useQuery(GRADES_BY_CLASS_QUERY, {
    variables: { classId, trimestre },
    skip: !classId,
    fetchPolicy: 'network-only',
  });

  const [bulkCreateGrades] = useMutation(BULK_CREATE_GRADES_MUTATION);
  const [updateGrade]      = useMutation(UPDATE_GRADE_MUTATION);

  // ── Derived data ──────────────────────────────────────────
  // Mes classSubjects pour la classe sélectionnée
  const mySubjectsForClass = useMemo(() => {
    const all: any[] = csData?.classSubjectsByTeacher ?? [];
    return all.filter((cs: any) => cs.class?.id === classId);
  }, [csData, classId]);

  // Toutes les classes que j'enseigne (unique)
  const myClasses = useMemo(() => {
    const all: any[] = csData?.classSubjectsByTeacher ?? [];
    const map = new Map<string, any>();
    for (const cs of all) if (cs.class && !map.has(cs.class.id)) map.set(cs.class.id, cs.class);
    return Array.from(map.values());
  }, [csData]);

  // Index: subjectId → studentId → grade object
  const gradeIndex = useMemo(() => {
    const idx: Record<string, Record<string, any[]>> = {};
    for (const g of (gradeData?.gradesByClass ?? [])) {
      const sid = g.classSubject?.subject?.id;
      if (!sid) continue;
      if (!idx[sid]) idx[sid] = {};
      if (!idx[sid][g.student?.id]) idx[sid][g.student.id] = [];
      idx[sid][g.student.id].push(g);
    }
    return idx;
  }, [gradeData]);

  // Per-student average across all my subjects
  const studentAvg = useMemo(() => {
    const avg: Record<string, number | null> = {};
    for (const st of students) {
      const vals: number[] = [];
      const coeffs: number[] = [];
      for (const cs of mySubjectsForClass) {
        const subGrades = gradeIndex[cs.subject?.id]?.[st.id] ?? [];
        if (subGrades.length === 0) continue;
        const mean = subGrades.reduce((s: number, g: any) => s + Number(g.valeur), 0) / subGrades.length;
        vals.push(mean * cs.coefficient);
        coeffs.push(cs.coefficient);
      }
      const totalCoeff = coeffs.reduce((s, c) => s + c, 0);
      avg[st.id] = totalCoeff > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / totalCoeff) * 100) / 100 : null;
    }
    return avg;
  }, [students, mySubjectsForClass, gradeIndex]);

  // Per-subject class average
  const subjectAvg = useMemo(() => {
    const avg: Record<string, number | null> = {};
    for (const cs of mySubjectsForClass) {
      const sid = cs.subject?.id;
      const vals: number[] = [];
      for (const st of students) {
        const sg = gradeIndex[sid]?.[st.id] ?? [];
        if (sg.length > 0) sg.forEach((g: any) => vals.push(Number(g.valeur)));
      }
      avg[sid] = vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : null;
    }
    return avg;
  }, [mySubjectsForClass, students, gradeIndex]);

  // ── Handlers ─────────────────────────────────────────────
  const handleNewGrade = useCallback((subjectId: string, studentId: string, value: string) => {
    setNewGrades(prev => ({
      ...prev,
      [subjectId]: { ...(prev[subjectId] ?? {}), [studentId]: value },
    }));
  }, []);

  const handleEditGrade = useCallback((gradeId: string, value: string) => {
    setPending(prev => ({ ...prev, [gradeId]: value }));
  }, []);

  const saveAll = async () => {
    if (saving) return;
    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // 1. Bulk create new grades per subject
      for (const cs of mySubjectsForClass) {
        const sid = cs.subject?.id;
        const entries = newGrades[sid] ?? {};
        const validEntries = Object.entries(entries)
          .filter(([, v]) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 20)
          .map(([studentId, valeur]) => ({ studentId, valeur: parseFloat(valeur) }));

        if (validEntries.length > 0) {
          try {
            await bulkCreateGrades({
              variables: {
                input: {
                  classSubjectId: cs.id,
                  trimestre,
                  typeEval,
                  grades: validEntries,
                },
              },
            });
            successCount += validEntries.length;
          } catch (err: any) {
            errorCount += validEntries.length;
            console.error('Bulk create error:', parseGqlError(err));
          }
        }
      }

      // 2. Update existing grades that were edited
      for (const [gradeId, newVal] of Object.entries(pendingEdits)) {
        if (newVal === '' || isNaN(Number(newVal))) continue;
        try {
          await updateGrade({ variables: { id: gradeId, input: { valeur: parseFloat(newVal) } } });
          successCount++;
        } catch (err: any) {
          errorCount++;
          console.error('Update error:', parseGqlError(err));
        }
      }

      if (successCount > 0) {
        addToast({ type: 'success', title: `${successCount} note(s) sauvegardée(s) ✓` });
        setNewGrades({});
        setPending({});
        await refetch();
      }
      if (errorCount > 0) addToast({ type: 'error', title: `${errorCount} erreur(s)`, message: 'Certaines notes n\'ont pas pu être sauvegardées' });

    } finally {
      setSaving(false);
    }
  };

  const hasPendingChanges = Object.values(newGrades).some(s => Object.values(s).some(v => v !== ''))
    || Object.keys(pendingEdits).length > 0;

  const handleExportXlsx = async () => {
    if (!classId || exporting) return;
    setExporting(true);
    try {
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace('/graphql', '');
      const token = tokenStorage.get() ?? '';
      const cls2 = myClasses.find((c: any) => c.id === classId);
      const className = cls2?.nom ?? 'Classe';
      const params = new URLSearchParams({ classId, trimestre, className, schoolName: schoolId });
      const res = await fetch(`${API_BASE}/export/grades?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(body.error ?? `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const cls = myClasses.find((c: any) => c.id === classId);
      a.download = `Notes_${cls?.nom ?? 'classe'}_${trimestre}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      addToast({ type: 'success', title: 'Export réussi', message: `Notes ${trimestre} téléchargées.` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur export', message: err.message ?? 'Impossible de télécharger le fichier' });
    } finally {
      setExporting(false);
    }
  };

  const totalGrades = gradeData?.gradesByClass?.length ?? 0;
  const classAvg = useMemo(() => {
    const vals = Object.values(studentAvg).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) / 100 : null;
  }, [studentAvg]);

  // Sorted students by name
  const sortedStudents = useMemo(() =>
    [...students].sort((a, b) => {
      const na = `${a.membership?.profile?.nom} ${a.membership?.profile?.prenom}`;
      const nb = `${b.membership?.profile?.nom} ${b.membership?.profile?.prenom}`;
      return na.localeCompare(nb, 'fr');
    }),
  [students]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx-primary)', letterSpacing: '-.03em' }}>Saisie des notes</h1>
          <p className="page-subtitle">
            {classId && sortedStudents.length > 0
              ? `${sortedStudents.length} élèves · ${totalGrades} note(s) · ${TRIMESTER_LABELS[trimestre]}`
              : 'Sélectionnez une classe pour saisir les notes'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {classId && (
            <button onClick={handleExportXlsx} disabled={exporting} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={15} />
              {exporting ? 'Export...' : 'Notes .xlsx'}
            </button>
          )}
          {hasPendingChanges && (
            <button onClick={saveAll} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} /> Sauvegarde...</>
                : <><Save size={15} /> Sauvegarder</>}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BookOpen size={15} style={{ color: 'var(--tx-muted)', flexShrink: 0 }} />

        {/* Classe */}
        <select className="input" style={{ width: 200, padding: '6px 12px', fontSize: 13 }}
          value={classId} onChange={e => { setClassId(e.target.value); setNewGrades({}); setPending({}); }}>
          <option value="">— Classe —</option>
          {myClasses.map((c: any) => <option key={c.id} value={c.id}>{c.nom}{c.level?.nom ? ` · ${c.level.nom}` : ''}</option>)}
        </select>

        {/* Trimestre */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TRIMESTERS.map(t => (
            <button key={t} onClick={() => setTrimestre(t)}
              style={{
                padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: '1px solid', cursor: 'pointer', transition: 'all .15s',
                background: trimestre === t ? '#6366f1' : 'var(--bg-card)',
                color: trimestre === t ? '#fff' : 'var(--tx-secondary)',
                borderColor: trimestre === t ? '#6366f1' : 'var(--bd)',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* Type d'éval */}
        <select className="input" style={{ width: 130, padding: '6px 12px', fontSize: 12 }}
          value={typeEval} onChange={e => setTypeEval(e.target.value as typeof typeEval)}>
          {EVAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Stats rapides */}
        {classAvg !== null && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: gradeTextColor(classAvg), letterSpacing: '-.03em' }}>{classAvg.toFixed(2)}</p>
              <p style={{ fontSize: 10, color: 'var(--tx-muted)', marginTop: 1 }}>Moy. classe</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: getMention(classAvg).color }}>{getMention(classAvg).label}</p>
              <p style={{ fontSize: 10, color: 'var(--tx-muted)', marginTop: 1 }}>Mention</p>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!classId && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', color: 'var(--tx-muted)' }}>
          <BookOpen size={44} style={{ marginBottom: 14, opacity: .3 }} />
          <p style={{ fontWeight: 600, fontSize: 14 }}>Sélectionnez une classe pour commencer</p>
          <p style={{ fontSize: 12, marginTop: 6, opacity: .7 }}>Les notes existantes apparaîtront dans le tableau, prêtes à être modifiées</p>
        </div>
      )}

      {/* Tableau notes */}
      {classId && mySubjectsForClass.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--tx-muted)' }}>
          <AlertCircle size={24} style={{ margin: '0 auto 8px', opacity: .5 }} />
          <p style={{ fontWeight: 600 }}>Aucune matière assignée pour cette classe</p>
        </div>
      )}

      {classId && mySubjectsForClass.length > 0 && sortedStudents.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                {/* Row 1: Subject names */}
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '2px solid var(--bd)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', minWidth: 160, position: 'sticky', left: 0, background: 'var(--bg-subtle)', zIndex: 2, borderRight: '2px solid var(--bd)' }}>
                    Élève
                  </th>
                  {mySubjectsForClass.map((cs: any) => (
                    <th key={cs.id} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--tx-primary)', borderLeft: '1px solid var(--bd)', minWidth: 90 }}>
                      <div style={{ lineHeight: 1.2 }}>{cs.subject?.nom}</div>
                      <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--tx-muted)', marginTop: 2 }}>coef. {cs.coefficient}</div>
                      {subjectAvg[cs.subject?.id] !== null && subjectAvg[cs.subject?.id] !== undefined && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: gradeTextColor(subjectAvg[cs.subject?.id]!), marginTop: 2 }}>
                          moy. {subjectAvg[cs.subject?.id]?.toFixed(2)}
                        </div>
                      )}
                    </th>
                  ))}
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--tx-secondary)', borderLeft: '2px solid var(--bd)', minWidth: 100, background: 'var(--bg-subtle)' }}>
                    Moyenne
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedStudents.map((student: any, idx: number) => {
                  const avg = studentAvg[student.id];
                  const mention = getMention(avg);
                  const name = `${student.membership?.profile?.nom ?? ''} ${student.membership?.profile?.prenom ?? ''}`.trim();
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--bd)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-subtle)' }}
                      className="hover:brightness-95 transition-all">
                      {/* Nom */}
                      <td style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, color: 'var(--tx-primary)', position: 'sticky', left: 0, background: 'inherit', zIndex: 1, borderRight: '2px solid var(--bd)', whiteSpace: 'nowrap' }}>
                        {name}
                        <div style={{ fontSize: 10, color: 'var(--tx-muted)', fontWeight: 400 }}>{student.matricule}</div>
                      </td>

                      {/* Cells per subject */}
                      {mySubjectsForClass.map((cs: any) => {
                        const sid = cs.subject?.id;
                        // ALL grades for this student+subject (all eval types)
                        const allGradesForCell = gradeIndex[sid]?.[student.id] ?? [];
                        const existingByType = allGradesForCell.filter((g: any) => g.typeEval === typeEval);
                        const latestExisting = existingByType[existingByType.length - 1];
                        const newVal = newGrades[sid]?.[student.id] ?? '';
                        // History: other eval types
                        const historyGrades = allGradesForCell.filter((g: any) => g.typeEval !== typeEval);

                        return (
                          <td key={cs.id} style={{ borderLeft: '1px solid var(--bd)', padding: 0, height: 36, position: 'relative' }}>
                            <div className="group" style={{ height: '100%', position: 'relative' }}>
                              {latestExisting ? (
                                <div style={{ position: 'relative' }}>
                                  <GradeCell
                                    value={String(pendingEdits[latestExisting.id] ?? latestExisting.valeur)}
                                    onChange={v => handleEditGrade(latestExisting.id, v)}
                                    onBlur={() => {}}
                                  />
                                  {pendingEdits[latestExisting.id] !== undefined && pendingEdits[latestExisting.id] !== String(latestExisting.valeur) && (
                                    <div style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} title="Modifié — non sauvegardé" />
                                  )}
                                </div>
                              ) : (
                                <GradeCell
                                  value={newVal}
                                  onChange={v => handleNewGrade(sid, student.id, v)}
                                  onBlur={() => {}}
                                />
                              )}
                              {/* History tooltip */}
                              {historyGrades.length > 0 && (
                                <div style={{
                                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                                  background: '#1e293b', color: '#fff', borderRadius: 8, padding: '8px 12px',
                                  fontSize: 11, whiteSpace: 'nowrap', zIndex: 50, pointerEvents: 'none',
                                  opacity: 0, transition: 'opacity .15s',
                                  boxShadow: '0 4px 16px rgba(0,0,0,.3)',
                                  marginBottom: 4,
                                }} className="group-hover:!opacity-100">
                                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                                    Autres évaluations
                                  </div>
                                  {historyGrades.map((g: any) => (
                                    <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                      <span style={{ color: '#94a3b8' }}>{g.typeEval}</span>
                                      <span style={{ fontWeight: 700, color: gradeTextColor(Number(g.valeur)) }}>{Number(g.valeur).toFixed(2)}</span>
                                    </div>
                                  ))}
                                  {/* Arrow */}
                                  <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1e293b' }} />
                                </div>
                              )}
                              {/* Small dot indicator if other grades exist */}
                              {historyGrades.length > 0 && (
                                <div style={{ position: 'absolute', top: 2, left: 2, width: 5, height: 5, borderRadius: '50%', background: '#6366f1', opacity: .6 }} title={`${historyGrades.length} autre(s) éval`} />
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Moyenne élève */}
                      <td style={{ borderLeft: '2px solid var(--bd)', padding: '6px 10px', textAlign: 'center' }}>
                        {avg !== null ? (
                          <>
                            <p style={{ fontSize: 14, fontWeight: 800, color: gradeTextColor(avg), letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
                              {avg.toFixed(2)}
                            </p>
                            <p style={{ fontSize: 10, fontWeight: 600, color: mention.color, marginTop: 1 }}>
                              {mention.label}
                            </p>
                          </>
                        ) : (
                          <span style={{ color: 'var(--tx-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer: class averages */}
              <tfoot>
                <tr style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--bd)' }}>
                  <td style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--tx-secondary)', position: 'sticky', left: 0, background: 'var(--bg-subtle)', borderRight: '2px solid var(--bd)' }}>
                    Moy. classe
                  </td>
                  {mySubjectsForClass.map((cs: any) => {
                    const avg = subjectAvg[cs.subject?.id];
                    return (
                      <td key={cs.id} style={{ borderLeft: '1px solid var(--bd)', textAlign: 'center', padding: '6px 4px' }}>
                        {avg !== null && avg !== undefined ? (
                          <span style={{ fontSize: 12, fontWeight: 800, color: gradeTextColor(avg), fontVariantNumeric: 'tabular-nums' }}>
                            {avg.toFixed(2)}
                          </span>
                        ) : <span style={{ color: 'var(--tx-muted)', fontSize: 11 }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ borderLeft: '2px solid var(--bd)', textAlign: 'center', padding: '6px 10px' }}>
                    {classAvg !== null ? (
                      <span style={{ fontSize: 14, fontWeight: 800, color: gradeTextColor(classAvg), fontVariantNumeric: 'tabular-nums' }}>
                        {classAvg.toFixed(2)}
                      </span>
                    ) : <span style={{ color: 'var(--tx-muted)' }}>—</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legend */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { min: 16, max: 20, label: '≥16 Excellent', bg: 'var(--grade-5-bg)', color: 'var(--grade-5-tx)' },
              { min: 12, max: 16, label: '12–16 Bien', bg: 'var(--grade-4-bg)', color: 'var(--grade-4-tx)' },
              { min: 10, max: 12, label: '10–12 Assez Bien', bg: 'var(--grade-3-bg)', color: 'var(--grade-3-tx)' },
              { min: 8, max: 10, label: '8–10 Passable', bg: 'var(--grade-2-bg)', color: 'var(--grade-2-tx)' },
              { min: 0, max: 8, label: '<8 Insuffisant', bg: 'var(--grade-1-bg)', color: 'var(--grade-1-tx)' },
            ].map(({ label, bg, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: '1px solid rgba(0,0,0,.08)' }} />
                <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ fontSize: 11, color: 'var(--tx-muted)' }}>Modification non sauvegardée</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating save bar */}
      {hasPendingChanges && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', borderRadius: 12,
          padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,.35)', zIndex: 100,
          animation: 'slideUp .2s ease',
        }}>
          <AlertCircle size={16} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {(() => {
              const newCount = Object.values(newGrades).reduce((s, sub) => s + Object.values(sub).filter(v => v !== '').length, 0);
              const editCount = Object.keys(pendingEdits).length;
              const parts = [];
              if (newCount > 0) parts.push(`${newCount} nouvelle(s)`);
              if (editCount > 0) parts.push(`${editCount} modifiée(s)`);
              return parts.join(' · ') + ' note(s) en attente';
            })()}
          </span>
          <button onClick={saveAll} disabled={saving}
            style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={13} />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          <button onClick={() => { setNewGrades({}); setPending({}); }}
            style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
