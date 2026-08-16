'use client';
import { parseGqlError } from '@/lib/errorUtils';
import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { useToast } from '@/components/ui/Toast';
import { Calendar, Plus, X, GripVertical, AlertTriangle } from 'lucide-react';
import {
  CLASSES_BY_SCHOOL_QUERY,
  CLASS_SUBJECTS_BY_CLASS_QUERY,
  CREATE_SCHEDULE_MUTATION,
  DELETE_SCHEDULE_MUTATION,
  UPDATE_SCHEDULE_MUTATION,
  SCHEDULE_BY_CLASS_QUERY,
  SCHEDULE_BY_TEACHER_MEMBERSHIP_QUERY,
} from '@/lib/graphql/queries';
import { chartSeries } from '@/lib/chartColors';

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOURS_SHORT = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const HOUR_START  = 7;
const HOUR_END    = 19;
const SLOT_H      = 56; // px per hour
const HALF_H      = SLOT_H / 2;
const HOURS       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

// Avant : 8 couleurs hex choisies au hasard, sans rapport avec la palette
// utilisée partout ailleurs (StatCards, graphiques, teacher/student
// schedule). Désormais dérivées de chartSeries, dans le même ordre.
const SUBJECT_COLORS = chartSeries.map((hex) => ({
  bg: `${hex}15`, border: hex, text: hex,
}));

function timeToMins(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function minsToTime(m: number) { return `${Math.floor(m/60).toString().padStart(2,'0')}:${(m%60).toString().padStart(2,'0')}`; }
function timeToY(t: string) { return ((timeToMins(t) - HOUR_START * 60) / 60) * SLOT_H; }
function slotH(s: string, e: string) { return ((timeToMins(e) - timeToMins(s)) / 60) * SLOT_H; }
function overlaps(s1: string, e1: string, s2: string, e2: string) {
  return timeToMins(s1) < timeToMins(e2) && timeToMins(e1) > timeToMins(s2);
}

function SlotModal({ classSubjects, pre, onClose, onSaved }: {
  classSubjects: any[]; pre?: any; onClose: () => void; onSaved: (d: any) => void;
}) {
  const [form, setForm] = useState({ classSubjectId: '', jour: String(pre?.jour ?? 1), heureDebut: pre?.heureDebut ?? '08:00', heureFin: pre?.heureFin ?? '09:00', salle: '' });
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const selectedCs = classSubjects.find((cs: any) => cs.id === form.classSubjectId);
  const teacherMembershipId = selectedCs?.teacher?.id;

  // Emploi du temps complet de l'enseignant sélectionné, pour avertir
  // AVANT la soumission plutôt que de laisser l'admin découvrir le
  // conflit seulement après avoir cliqué "Ajouter" (le backend bloque
  // toujours l'enregistrement dans tous les cas — ceci n'est qu'un avertissement plus tôt).
  const { data: teacherSchedData } = useQuery(SCHEDULE_BY_TEACHER_MEMBERSHIP_QUERY, {
    variables: { teacherMembershipId },
    skip: !teacherMembershipId,
  });
  const teacherSlots: any[] = teacherSchedData?.scheduleByTeacherMembership ?? [];

  const conflict = teacherSlots.find((s: any) =>
    s.jour === parseInt(form.jour) &&
    s.classSubject?.id !== form.classSubjectId && // même classSubject = créneau existant qu'on ne compare pas à lui-même
    overlaps(form.heureDebut, form.heureFin, s.heureDebut, s.heureFin)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[var(--tx-primary)]">Nouveau créneau</h2>
          <button onClick={onClose}><X size={18} className="text-[var(--tx-muted)]" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Matière · Enseignant *</label>
            <select className="input text-sm" value={form.classSubjectId} onChange={e => f('classSubjectId', e.target.value)} autoFocus>
              <option value="">Sélectionner...</option>
              {classSubjects.map((cs: any) => (
                <option key={cs.id} value={cs.id}>{cs.subject?.nom} — {cs.teacher?.profile?.prenom} {cs.teacher?.profile?.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Jour *</label>
            <div className="flex gap-1.5">
              {[1,2,3,4,5].map(j => (
                <button key={j} type="button" onClick={() => f('jour', String(j))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.jour === String(j) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-[var(--bg-card)] border-[var(--bd)] text-[var(--tx-secondary)]'}`}>
                  {JOURS_SHORT[j]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Début</label><input className="input text-sm" type="time" value={form.heureDebut} onChange={e => f('heureDebut', e.target.value)} /></div>
            <div><label className="label">Fin</label><input className="input text-sm" type="time" value={form.heureFin} onChange={e => f('heureFin', e.target.value)} /></div>
          </div>
          <div><label className="label">Salle</label><input className="input text-sm" value={form.salle} onChange={e => f('salle', e.target.value)} placeholder="ex: A101..." /></div>

          {conflict && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--err-bg)', borderRadius: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} style={{ color: 'var(--err)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: 'var(--err)', lineHeight: 1.5 }}>
                {selectedCs?.teacher?.profile?.prenom} {selectedCs?.teacher?.profile?.nom} a déjà cours
                en <strong>{conflict.classSubject?.class?.nom}</strong> ({conflict.classSubject?.subject?.nom})
                de {conflict.heureDebut} à {conflict.heureFin} ce jour-là.
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary text-sm py-2">Annuler</button>
          <button
            onClick={() => onSaved({ ...form, jour: parseInt(form.jour) })}
            disabled={!form.classSubjectId || !!conflict}
            title={conflict ? 'Conflit détecté — choisissez un autre horaire' : undefined}
            className="btn-primary text-sm py-2"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

function SlotBlock({ slot, color, onDelete, onDragStart }: { slot: any; color: any; onDelete: (id: string) => void; onDragStart: (e: React.DragEvent, s: any) => void }) {
  const h = slotH(slot.heureDebut, slot.heureFin);
  const y = timeToY(slot.heureDebut);
  const tiny = h < 34;
  return (
    <div draggable onDragStart={e => onDragStart(e, slot)}
      style={{ position: 'absolute', top: y, left: 2, right: 2, height: Math.max(h - 3, 18), background: color.bg, border: `1.5px solid ${color.border}`, borderRadius: 7, padding: tiny ? '2px 5px' : '4px 6px', cursor: 'grab', overflow: 'hidden', zIndex: 2, boxSizing: 'border-box' }}
      className="group select-none hover:shadow-md transition-shadow">
      <button onClick={e => { e.stopPropagation(); onDelete(slot.id); }}
        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(255,255,255,.9)', border: 'none', borderRadius: 3, width: 14, height: 14, cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }}
        className="group-hover:!opacity-100 transition-opacity"><X size={9} /></button>
      <p style={{ color: color.text, fontWeight: 700, fontSize: 11, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.classSubject?.subject?.nom}</p>
      {!tiny && <p style={{ color: color.text, opacity: .65, fontSize: 10, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{slot.heureDebut}–{slot.heureFin}</p>}
      {!tiny && slot.salle && <p style={{ color: color.text, opacity: .55, fontSize: 10 }}>{slot.salle}</p>}
    </div>
  );
}

export default function AdminSchedulePage() {
  const { addToast } = useToast();
  const schoolId  = tokenStorage.getSchoolId() ?? '';
  const [classId, setClassId] = useState('');
  const [showModal, setModal] = useState(false);
  const [modalPre, setModalPre] = useState<any>(undefined);
  const [dragging, setDragging] = useState<any>(null);
  const [dropJour, setDropJour] = useState<number | null>(null);

  const { data: classData }           = useQuery(CLASSES_BY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  const { data: scheduleData, refetch } = useQuery(SCHEDULE_BY_CLASS_QUERY, { variables: { classId }, skip: !classId });
  const { data: csData }              = useQuery(CLASS_SUBJECTS_BY_CLASS_QUERY, { variables: { classId }, skip: !classId });
  const [createSchedule]              = useMutation(CREATE_SCHEDULE_MUTATION);
  const [deleteSchedule]              = useMutation(DELETE_SCHEDULE_MUTATION);
  const [updateSchedule]              = useMutation(UPDATE_SCHEDULE_MUTATION);

  const classes       = classData?.classesBySchool ?? [];
  const schedules     = scheduleData?.scheduleByClass ?? [];
  const classSubjects = csData?.classSubjectsByClass ?? [];

  const colorMap: Record<string, any> = {};
  let ci = 0;
  for (const s of schedules) {
    const n = s.classSubject?.subject?.nom;
    if (n && !colorMap[n]) colorMap[n] = SUBJECT_COLORS[ci++ % SUBJECT_COLORS.length];
  }

  const byDay: Record<number, any[]> = { 1:[], 2:[], 3:[], 4:[], 5:[] };
  for (const s of schedules) if (s.jour >= 1 && s.jour <= 5) byDay[s.jour].push(s);

  const totalH = schedules.reduce((a: number, s: any) => a + (timeToMins(s.heureFin) - timeToMins(s.heureDebut)) / 60, 0);
  const gridH  = (HOUR_END - HOUR_START) * SLOT_H;

  const handleAdd = async (data: any) => {
    try {
      await createSchedule({ variables: { input: data } });
      addToast({ type: 'success', title: 'Créneau ajouté ✓' });
      setModal(false); setModalPre(undefined); refetch();
    } catch (err: any) {
      const msg = parseGqlError(err);
      addToast({ type: 'error', title: msg.includes('conflit') || msg.includes('conflict') ? 'Conflit horaire' : 'Erreur', message: msg });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce créneau ?')) return;
    try { await deleteSchedule({ variables: { id } }); addToast({ type: 'success', title: 'Créneau supprimé' }); refetch(); }
    catch (err: any) { addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) }); }
  };

  const handleDrop = async (e: React.DragEvent, jour: number) => {
    e.preventDefault();
    if (!dragging) return;
    const col  = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - col.top;
    const snappedMins = HOUR_START * 60 + Math.round((relY / SLOT_H) * 60 / 30) * 30;
    const clamped = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - 30, snappedMins));
    const dur  = timeToMins(dragging.heureFin) - timeToMins(dragging.heureDebut);
    const newS = minsToTime(clamped);
    const newE = minsToTime(clamped + dur);
    if (dragging.jour === jour && dragging.heureDebut === newS) { setDragging(null); setDropJour(null); return; }
    try {
      await updateSchedule({ variables: { id: dragging.id, input: { jour, heureDebut: newS, heureFin: newE } } });
      addToast({ type: 'success', title: 'Créneau déplacé ✓' }); refetch();
    } catch (err: any) {
      const msg = parseGqlError(err);
      addToast({ type: 'error', title: msg.includes('conflit') || msg.includes('conflict') ? 'Conflit horaire' : 'Erreur déplacement', message: msg });
    }
    setDragging(null); setDropJour(null);
  };

  const handleGridClick = (e: React.MouseEvent, jour: number) => {
    if ((e.target as HTMLElement).closest('button, [draggable]')) return;
    const col  = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - col.top;
    const mins = HOUR_START * 60 + Math.round((relY / SLOT_H) * 60 / 30) * 30;
    const s    = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - 60, mins));
    setModalPre({ jour, heureDebut: minsToTime(s), heureFin: minsToTime(s + 60) });
    setModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx-primary)', letterSpacing: '-.03em' }}>Emploi du temps</h1>
          <p className="page-subtitle">{schedules.length > 0 ? `${schedules.length} créneaux · ${totalH.toFixed(1)}h/semaine` : 'Grille hebdomadaire interactive'}</p>
        </div>
        {classId && (
          <button onClick={() => { setModalPre(undefined); setModal(true); }} className="btn-primary">
            <Plus size={15} /> Ajouter un créneau
          </button>
        )}
      </div>

      {/* Sélecteur + légende */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Calendar size={15} style={{ color: 'var(--tx-muted)', flexShrink: 0 }} />
        <select className="input" style={{ width: 240, padding: '6px 12px', fontSize: 13 }} value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">— Sélectionner une classe —</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.nom} — {c.level?.nom}</option>)}
        </select>
        {Object.entries(colorMap).map(([name, style]: any) => (
          <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, background: style.bg, color: style.text, border: `1px solid ${style.border}`, borderRadius: 6, padding: '2px 8px' }}>{name}</span>
        ))}
      </div>

      {!classId ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px', color: 'var(--tx-muted)' }}>
          <Calendar size={44} style={{ marginBottom: 14, opacity: .3 }} />
          <p style={{ fontWeight: 600, fontSize: 14 }}>Sélectionnez une classe pour voir son emploi du temps</p>
          <p style={{ fontSize: 12, marginTop: 6, opacity: .7 }}>Cliquez sur la grille pour ajouter des créneaux · Glissez pour les déplacer</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>

          {/* En-tête jours */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(48px,48px) repeat(5, minmax(120px,1fr))', borderBottom: '2px solid var(--bd)', background: 'var(--bg-subtle)' }}>
            <div />
            {[1,2,3,4,5].map(j => (
              <div key={j} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid var(--bd)' }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx-primary)' }}>{JOURS[j]}</p>
                <p style={{ fontSize: 10, color: 'var(--tx-muted)', marginTop: 2 }}>{byDay[j].length} créneau{byDay[j].length !== 1 ? 'x' : ''}</p>
              </div>
            ))}
          </div>

          {/* Grille */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(48px,48px) repeat(5, minmax(120px,1fr))', overflowY: 'auto', maxHeight: 560 }}>

            {/* Heures */}
            <div style={{ position: 'relative', height: gridH, borderRight: '1px solid var(--bd)' }}>
              {HOURS.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h - HOUR_START) * SLOT_H - 8, right: 6, fontSize: 10, fontWeight: 600, color: 'var(--tx-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {String(h).padStart(2, '0')}h
                </div>
              ))}
            </div>

            {/* Colonnes */}
            {[1,2,3,4,5].map(jour => (
              <div key={jour}
                style={{ position: 'relative', height: gridH, borderLeft: '1px solid var(--bd)', cursor: 'crosshair', background: dropJour === jour ? 'rgba(99,102,241,.04)' : 'transparent', transition: 'background .1s' }}
                onClick={e => handleGridClick(e, jour)}
                onDragOver={e => { e.preventDefault(); setDropJour(jour); }}
                onDragLeave={() => setDropJour(null)}
                onDrop={e => handleDrop(e, jour)}
              >
                {/* Lignes heures */}
                {HOURS.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h - HOUR_START) * SLOT_H, left: 0, right: 0, borderTop: '1px solid var(--bd)', pointerEvents: 'none' }} />
                ))}
                {/* Lignes demi-heures */}
                {HOURS.slice(0, -1).map(h => (
                  <div key={h + .5} style={{ position: 'absolute', top: (h - HOUR_START) * SLOT_H + HALF_H, left: 0, right: 0, borderTop: '1px dashed var(--bd)', opacity: .4, pointerEvents: 'none' }} />
                ))}
                {/* Drop indicator */}
                {dropJour === jour && dragging && (
                  <div style={{ position: 'absolute', top: '50%', left: 4, right: 4, height: 2, background: '#6366f1', borderRadius: 2, pointerEvents: 'none', zIndex: 10, boxShadow: '0 0 8px rgba(99,102,241,.5)' }} />
                )}
                {/* Blocs */}
                {byDay[jour].map((s: any) => (
                  <SlotBlock key={s.id} slot={s} color={colorMap[s.classSubject?.subject?.nom] ?? SUBJECT_COLORS[0]} onDelete={handleDelete} onDragStart={(e, sl) => { setDragging(sl); e.dataTransfer.effectAllowed = 'move'; }} />
                ))}
              </div>
            ))}
          </div>

          {/* Légende */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[{ icon: <Plus size={12} />, label: 'Cliquer pour ajouter' }, { icon: <GripVertical size={12} />, label: 'Glisser pour déplacer' }, { icon: <X size={12} />, label: 'Survoler → croix pour supprimer' }].map(({ icon, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--tx-muted)' }}>{icon} {label}</div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {schedules.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { val: schedules.length, label: 'Créneaux', color: 'var(--tx-primary)' },
            { val: totalH.toFixed(1) + 'h', label: 'Par semaine', color: '#6366f1' },
            { val: Object.keys(colorMap).length, label: 'Matières', color: 'var(--tx-primary)' },
          ].map(({ val, label, color }) => (
            <div key={label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
              <p style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-.04em' }}>{val}</p>
              <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 3 }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SlotModal classSubjects={classSubjects} pre={modalPre} onClose={() => { setModal(false); setModalPre(undefined); }} onSaved={handleAdd} />
      )}
    </div>
  );
}
