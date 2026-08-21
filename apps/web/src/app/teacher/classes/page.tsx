'use client';
import { useToast } from '@/components/ui/Toast';
import { parseGqlError } from '@/lib/errorUtils';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { BookOpen, CheckSquare, PenLine, Users, ChevronRight, Calendar } from 'lucide-react';
import { ATTENDANCE_BY_CLASS_SUBJECT_QUERY, BULK_CREATE_GRADES_MUTATION, CLASS_SUBJECTS_BY_TEACHER_QUERY, GRADES_BY_CLASS_SUBJECT_QUERY, MARK_ATTENDANCE_MUTATION, STUDENTS_BY_CLASS_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const TRIMESTRES = ['T1', 'T2', 'T3'] as const;
const EVAL_TYPES = ['DEVOIR', 'CONTROLE', 'EXAMEN', 'INTERRO'] as const;
const STATUTS = ['PRESENT', 'ABSENT', 'RETARD'] as const;
type Statut = typeof STATUTS[number];
const STATUT_CONFIG: Record<Statut, { label: string; active: string; idle: string }> = {
  PRESENT: {
    label: 'Présent',
    active: 'bg-emerald-600 text-white shadow-sm',
    idle: 'bg-[var(--bg-subtle)] text-[var(--tx-muted)] hover:bg-emerald-50 hover:text-emerald-700',
  },
  ABSENT: {
    label: 'Absent',
    active: 'bg-red-600 text-white shadow-sm',
    idle: 'bg-[var(--bg-subtle)] text-[var(--tx-muted)] hover:bg-red-50 hover:text-red-700',
  },
  RETARD: {
    label: 'Retard',
    active: 'bg-amber-500 text-white shadow-sm',
    idle: 'bg-[var(--bg-subtle)] text-[var(--tx-muted)] hover:bg-amber-50 hover:text-amber-800',
  },
};

function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function AttendancePanel({ classSubject, students }: { classSubject: any; students: any[] }) {
  const [date, setDate] = useState(localISODate);
  const [records, setRecords] = useState<Record<string, Statut>>({});
  const [saved, setSaved] = useState(false);
  const dirtyRef = useRef(false);

  const { data: attData, loading: attLoading } = useQuery(ATTENDANCE_BY_CLASS_SUBJECT_QUERY, {
    variables: { classSubjectId: classSubject.id, date },
    skip: !classSubject.id,
  });

  const [markAttendance, { loading }] = useMutation(MARK_ATTENDANCE_MUTATION);
  const studentKey = students.map((s: { id: string }) => s.id).join(',');

  useEffect(() => {
    dirtyRef.current = false;
  }, [date, classSubject.id]);

  useEffect(() => {
    if (dirtyRef.current) return;
    const init: Record<string, Statut> = {};
    students.forEach((s) => { init[s.id] = 'PRESENT'; });
    for (const a of attData?.attendanceByClassSubject ?? []) {
      const sid = a.studentId ?? a.student?.id;
      if (sid && (a.statut === 'PRESENT' || a.statut === 'ABSENT' || a.statut === 'RETARD')) {
        init[sid] = a.statut;
      }
    }
    setRecords(init);
  }, [studentKey, attData, students]);

  const setStatut = (studentId: string, statut: Statut) => {
    dirtyRef.current = true;
    setRecords((r) => ({ ...r, [studentId]: statut }));
    setSaved(false);
  };

  const { addToast } = useToast();
  const handleSave = async () => {
    const payload = Object.entries(records).map(([studentId, statut]) => ({ studentId, statut }));
    if (payload.length === 0) {
      addToast({ type: 'error', title: 'Aucun élève à enregistrer' });
      return;
    }
    try {
      await markAttendance({
        variables: {
          input: {
            classSubjectId: classSubject.id,
            date,
            records: payload,
          },
        },
        refetchQueries: [{
          query: ATTENDANCE_BY_CLASS_SUBJECT_QUERY,
          variables: { classSubjectId: classSubject.id, date },
        }],
      });
      dirtyRef.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      addToast({ type: 'success', title: 'Présences enregistrées' });
    } catch(err: any) {
      addToast({ type: 'error', title: 'Erreur présences', message: parseGqlError(err) });
    }
  };

  const presentCount = Object.values(records).filter((s) => s === 'PRESENT').length;
  const absentCount  = Object.values(records).filter((s) => s === 'ABSENT').length;
  const retardCount  = Object.values(records).filter((s) => s === 'RETARD').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5 text-[var(--tx-muted)]">
            <Calendar size={14} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input py-1 text-xs"
            />
          </label>
          <span className="text-emerald-700 font-semibold">{presentCount} présents</span>
          <span className="text-red-600 font-semibold">{absentCount} absents</span>
          <span className="text-amber-600 font-semibold">{retardCount} retards</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              dirtyRef.current = true;
              setRecords(Object.fromEntries(students.map((s) => [s.id, 'PRESENT'])));
              setSaved(false);
            }}
            className="btn-secondary py-1 text-xs"
          >
            Tous présents
          </button>
          <button onClick={handleSave} disabled={loading || attLoading} className="btn-primary py-1">
            {saved ? '✓ Enregistré !' : loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {attLoading ? (
          <div className="flex items-center justify-center py-10 text-[var(--tx-muted)] text-sm">
            Chargement des présences...
          </div>
        ) : students.map((s, i) => {
          const st = (records[s.id] ?? 'PRESENT') as Statut;
          const profile = s.membership?.profile;
          return (
            <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-subtle)]">
              <span className="text-xs text-[var(--tx-muted)] w-6 text-right">{i + 1}.</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[var(--info-bg)] flex items-center justify-center
                                text-[var(--tx-primary)] text-xs font-bold flex-shrink-0">
                  {profile?.prenom?.[0] ?? '?'}
                </div>
                <span className="text-sm font-medium text-[var(--tx-primary)] truncate">
                  {profile?.prenom} {profile?.nom}
                </span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {STATUTS.map((statut) => {
                  const cfg = STATUT_CONFIG[statut];
                  const active = st === statut;
                  return (
                    <button
                      key={statut}
                      type="button"
                      onClick={() => setStatut(s.id, statut)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${active ? cfg.active : cfg.idle}`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GradesPanel({ classSubject, students }: { classSubject: any; students: any[] }) {
  const [trimestre, setTrimestre] = useState<typeof TRIMESTRES[number]>('T1');
  const [typeEval, setTypeEval]   = useState<typeof EVAL_TYPES[number]>('DEVOIR');
  const [notes, setNotes]         = useState<Record<string, string>>({});
  const [bulkCreate, { loading }] = useMutation(BULK_CREATE_GRADES_MUTATION);
  const [saved, setSaved]         = useState(false);

  const { data, refetch: refetchGrades } = useQuery(GRADES_BY_CLASS_SUBJECT_QUERY, {
    variables: { classSubjectId: classSubject.id, trimestre },
  });
  const existingGrades = data?.gradesByClassSubject ?? [];

  const getExisting = (studentId: string) => {
    const g = existingGrades.filter((g: any) => g.student?.id === studentId && g.typeEval === typeEval);
    return g.length > 0 ? g.map((g: any) => Number(g.valeur).toFixed(2)).join(', ') : null;
  };

  const { addToast: addGradeToast } = useToast();
  const handleSave = async () => {
    const grades = (Object.entries(notes) as [string, string][])
      .filter(([, v]) => v !== '' && !isNaN(parseFloat(v)))
      .map(([studentId, valeur]) => ({ studentId, valeur: parseFloat(valeur) }));
    if (grades.length === 0) return;

    try {
      await bulkCreate({
        variables: {
          input: { classSubjectId: classSubject.id, trimestre, typeEval, grades },
        },
      });
      await refetchGrades(); // affiche immédiatement les notes qui viennent d'être saisies
      setNotes({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      addGradeToast({ type: 'success', title: `${grades.length} note(s) enregistrée(s)` });
    } catch(err: any) {
      addGradeToast({ type: 'error', title: 'Erreur notes', message: parseGqlError(err) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {TRIMESTRES.map((t) => (
            <button
              key={t}
              onClick={() => setTrimestre(t)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all
                ${trimestre === t ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-card)] border border-[var(--bd)] text-[var(--tx-secondary)]'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {EVAL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeEval(t)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all
                ${typeEval === t ? 'bg-violet-600 text-white' : 'bg-[var(--bg-card)] border border-[var(--bd)] text-[var(--tx-secondary)]'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button onClick={handleSave} disabled={loading} className="btn-primary py-1 ml-auto">
          {saved ? '✓ Sauvegardé !' : 'Enregistrer les notes'}
        </button>
      </div>

      <div className="space-y-1.5">
        {students.map((s, i) => {
          const profile  = s.membership?.profile;
          const existing = getExisting(s.id);
          return (
            <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-subtle)]">
              <span className="text-xs text-[var(--tx-muted)] w-6 text-right">{i + 1}.</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--info-bg)] flex items-center justify-center
                                text-[var(--tx-primary)] text-xs font-bold">
                  {profile?.prenom?.[0] ?? '?'}
                </div>
                <span className="text-sm font-medium text-[var(--tx-primary)]">
                  {profile?.prenom} {profile?.nom}
                </span>
              </div>
              {existing && (
                <span className="text-xs text-[var(--tx-muted)] italic">{existing}</span>
              )}
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                placeholder="— /20"
                value={notes[s.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                className="w-20 input py-1 text-sm text-center"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TeacherClassesPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [activeCS, setActiveCS]   = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'presence'|'notes'>('presence');

  const { data } = useQuery(CLASS_SUBJECTS_BY_TEACHER_QUERY, { variables: { schoolId }, skip: !schoolId });
  const classSubjects = data?.classSubjectsByTeacher ?? [];

  const { data: studentData } = useQuery(STUDENTS_BY_CLASS_QUERY, {
    variables: { classId: activeCS?.class?.id, pagination: { page: 1, limit: 200 } },
    skip:      !activeCS?.class?.id,
  });
  const students = studentData?.studentsByClass?.data ?? [];

  const grouped: Record<string, any[]> = {};
  for (const cs of classSubjects) {
    const cname = cs.class?.nom ?? 'Autre';
    if (!grouped[cname]) grouped[cname] = [];
    grouped[cname].push(cs);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Mes Classes</h1>
        <p className="text-[var(--tx-muted)] text-sm mt-0.5">
          {classSubjects.length} matière(s) assignée(s)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Liste classes */}
        <div className="space-y-4">
          {Object.entries(grouped).map(([className, csList]) => (
            <div key={className} className="card">
              <h3 className="font-bold text-[var(--tx-secondary)] mb-3 flex items-center gap-2">
                <BookOpen size={16} className="text-[var(--tx-secondary)]" /> {className}
              </h3>
              <div className="space-y-2">
                {csList.map((cs) => (
                  <button
                    key={cs.id}
                    onClick={() => { setActiveCS(cs); setActiveTab('presence'); }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl
                      border transition-all text-left
                      ${activeCS?.id === cs.id
                        ? 'border-indigo-300 bg-[var(--info-bg)]'
                        : 'border-[var(--bd)] hover:border-[var(--bd)] hover:bg-[var(--bg-subtle)]'}`}
                  >
                    <div>
                      <p className="font-semibold text-[var(--tx-primary)] text-sm">{cs.subject?.nom}</p>
                      <p className="text-xs text-[var(--tx-muted)]">
                        Coef. {cs.coefficient}
                        {cs.schedules?.length > 0 && (
                          <span> · {cs.schedules.map((s: any) => `${JOURS[s.jour]} ${s.heureDebut}`).join(', ')}</span>
                        )}
                      </p>
                    </div>
                    <ChevronRight size={15} className="text-[var(--tx-muted)]" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {classSubjects.length === 0 && (
            <div className="card flex flex-col items-center justify-center py-12 text-[var(--tx-muted)]">
              <BookOpen size={36} className="mb-3 opacity-40" />
              <p className="font-medium">Aucune matière assignée</p>
            </div>
          )}
        </div>

        {/* Panel actif */}
        {activeCS ? (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-[var(--tx-primary)]">
                  {activeCS.subject?.nom} — {activeCS.class?.nom}
                </h2>
                <p className="text-sm text-[var(--tx-muted)]">{students.length} élèves</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('presence')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    ${activeTab === 'presence' ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-subtle)] text-[var(--tx-secondary)]'}`}
                >
                  <CheckSquare size={13} /> Présences
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    ${activeTab === 'notes' ? 'bg-violet-600 text-white' : 'bg-[var(--bg-subtle)] text-[var(--tx-secondary)]'}`}
                >
                  <PenLine size={13} /> Notes
                </button>
              </div>
            </div>

            {students.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-[var(--tx-muted)] text-sm">
                Aucun élève dans cette classe
              </div>
            ) : activeTab === 'presence' ? (
              <AttendancePanel key={activeCS.id} classSubject={activeCS} students={students} />
            ) : (
              <GradesPanel classSubject={activeCS} students={students} />
            )}
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
            <Users size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Sélectionnez une matière</p>
            <p className="text-sm mt-1">pour prendre les présences ou saisir des notes</p>
          </div>
        )}
      </div>
    </div>
  );
}
