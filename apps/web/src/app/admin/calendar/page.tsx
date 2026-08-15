'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { CLASSES_BY_SCHOOL_QUERY, SCHOOL_MEMBERS_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { gql } from '@apollo/client';
import { chartSeries } from '@/lib/chartColors';
import {
  ChevronLeft, ChevronRight, Calendar, Users,
  BookOpen, Clock, MapPin, Filter
} from 'lucide-react';

const SCHEDULES_ALL_QUERY = gql`
  query SchedulesAll($schoolId: ID!) {
    classesBySchool(schoolId: $schoolId) {
      id nom
      classSubjects {
        id
        subject { id nom }
        teacher { id profile { nom prenom } }
        schedules { id jour heureDebut heureFin salle }
      }
    }
  }
`;

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const JOURS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HOURS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

// Avant : 10 couleurs hex arbitraires, différentes de toutes les autres
// palettes de la plateforme. Désormais chartSeries (cycle via % COLORS.length).
const COLORS = chartSeries;

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const DAY_START = timeToMinutes('07:00');
const DAY_TOTAL = timeToMinutes('19:00') - DAY_START;

export default function CalendarPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [selectedClass, setClass] = useState('');
  const [selectedTeacher, setTeacher] = useState('');

  const { data } = useQuery(SCHEDULES_ALL_QUERY, { variables: { schoolId }, skip: !schoolId });
  const { data: teacherData } = useQuery(SCHOOL_MEMBERS_QUERY, {
    variables: { schoolId, role: 'TEACHER', pagination: { page: 1, limit: 200 } },
    skip: !schoolId,
  });

  const classes  = data?.classesBySchool ?? [];
  const teachers = teacherData?.schoolMembers?.data ?? [];

  // Construire tous les créneaux
  const allSlots = useMemo(() => {
    const slots: any[] = [];
    let colorIdx = 0;
    const subjectColors: Record<string, string> = {};

    for (const cls of classes) {
      for (const cs of cls.classSubjects ?? []) {
        if (!subjectColors[cs.subject?.id]) {
          subjectColors[cs.subject?.id] = COLORS[colorIdx++ % COLORS.length];
        }
        for (const s of cs.schedules ?? []) {
          slots.push({
            ...s,
            className: cls.nom,
            classId: cls.id,
            subjectNom: cs.subject?.nom,
            subjectColor: subjectColors[cs.subject?.id],
            teacherName: cs.teacher ? `${cs.teacher.profile?.prenom} ${cs.teacher.profile?.nom}` : '',
            teacherMembershipId: cs.teacher?.id,
          });
        }
      }
    }
    return slots;
  }, [classes]);

  // Filtrer
  const filtered = allSlots.filter(s => {
    if (selectedClass && s.classId !== selectedClass) return false;
    if (selectedTeacher && s.teacherMembershipId !== selectedTeacher) return false;
    return true;
  });

  // Compter cours par jour
  const statsByDay = JOURS.map((_, dayIdx) => ({
    count: filtered.filter(s => s.jour === dayIdx + 1).length
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Emploi du temps global</h1>
          <p className="page-subtitle">Vue calendrier de tous les cours</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="input" style={{ width: 160 }} value={selectedClass} onChange={e => setClass(e.target.value)}>
            <option value="">Toutes les classes</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select className="input" style={{ width: 180 }} value={selectedTeacher} onChange={e => setTeacher(e.target.value)}>
            <option value="">Tous les enseignants</option>
            {teachers.map((t: any) => (
              <option key={t.id} value={t.id}>{t.profile?.prenom} {t.profile?.nom}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {JOURS.map((j, i) => (
          <div key={j} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{j}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx-primary)', lineHeight: 1 }}>{statsByDay[i].count}</p>
            <p style={{ fontSize: 10, color: 'var(--tx-muted)', marginTop: 2 }}>cours</p>
          </div>
        ))}
      </div>

      {/* Grille calendrier */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Défilement horizontal sur petit écran : la grille des 6 jours ne
            doit jamais se comprimer au point de devenir illisible. */}
        <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 640 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(6, 1fr)', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ padding: '10px 8px', background: 'var(--bg-subtle)' }} />
          {JOURS_FULL.map(j => (
            <div key={j} style={{
              padding: '10px 8px', background: 'var(--bg-subtle)',
              borderLeft: '1px solid var(--bd)',
              fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', textAlign: 'center',
            }}>{j}</div>
          ))}
        </div>

        <div style={{ position: 'relative', overflowY: 'auto', maxHeight: 520 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(6, 1fr)', position: 'relative' }}>
            {/* Heures */}
            <div>
              {HOURS.map(h => (
                <div key={h} style={{ height: 56, padding: '4px 8px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, color: 'var(--tx-muted)', fontWeight: 600 }}>{h}</span>
                </div>
              ))}
            </div>

            {/* Colonnes jours */}
            {JOURS.map((_, dayIdx) => {
              const daySlots = filtered.filter(s => s.jour === dayIdx + 1);
              return (
                <div key={dayIdx} style={{ borderLeft: '1px solid var(--bd)', position: 'relative' }}>
                  {HOURS.map(h => (
                    <div key={h} style={{ height: 56, borderBottom: '1px solid var(--bd)' }} />
                  ))}
                  {/* Créneaux */}
                  {daySlots.map((slot, si) => {
                    const start  = timeToMinutes(slot.heureDebut);
                    const end    = timeToMinutes(slot.heureFin);
                    const top    = ((start - DAY_START) / DAY_TOTAL) * (HOURS.length * 56);
                    const height = ((end - start) / DAY_TOTAL) * (HOURS.length * 56);
                    return (
                      <div key={si} style={{
                        position: 'absolute', left: 3, right: 3,
                        top: top + 2, height: height - 4,
                        background: slot.subjectColor + '20',
                        border: `1.5px solid ${slot.subjectColor}40`,
                        borderLeft: `3px solid ${slot.subjectColor}`,
                        borderRadius: 6, padding: '4px 6px',
                        overflow: 'hidden', cursor: 'default',
                      }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: slot.subjectColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {slot.subjectNom}
                        </p>
                        {height > 40 && (
                          <p style={{ fontSize: 10, color: 'var(--tx-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {slot.className} {slot.salle ? `· ${slot.salle}` : ''}
                          </p>
                        )}
                        {height > 56 && slot.teacherName && (
                          <p style={{ fontSize: 10, color: 'var(--tx-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {slot.teacherName}
                          </p>
                        )}
                        <p style={{ fontSize: 9, color: 'var(--tx-muted)', marginTop: 1 }}>
                          {slot.heureDebut}–{slot.heureFin}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--tx-muted)' }}>
          <Calendar size={36} style={{ margin: '0 auto 12px', opacity: .4 }} />
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Aucun cours programmé</p>
          <p style={{ fontSize: 12 }}>Ajoutez des emplois du temps depuis la page <a href="/admin/schedules" style={{ color: 'var(--accent)' }}>Emplois du temps</a></p>
        </div>
      )}
    </div>
  );
}
