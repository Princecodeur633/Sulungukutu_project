'use client';

import { useQuery } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { CLASS_SUBJECTS_BY_TEACHER_QUERY } from '@/lib/graphql/queries';
import { Calendar } from 'lucide-react';
import { chartSeries } from '@/lib/chartColors';

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
// Avant : 8 couleurs Tailwind choisies au hasard (indigo/emerald/violet/
// amber/sky/rose/teal/orange), sans rapport avec la palette du reste de
// la plateforme. Désormais dérivées de chartSeries (même séquence que
// les graphiques et StatCards partout ailleurs).
function subjectColor(index: number) {
  const hex = chartSeries[index % chartSeries.length];
  return { background: `${hex}1a`, color: hex, border: `1px solid ${hex}33` };
}

export default function TeacherSchedulePage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const today    = new Date().getDay(); // 0=dim, 1=lun…

  const { data, loading } = useQuery(CLASS_SUBJECTS_BY_TEACHER_QUERY, {
    variables: { schoolId },
    skip: !schoolId,
  });

  const classSubjects: any[] = data?.classSubjectsByTeacher ?? [];

  // Aplatir les créneaux de chaque classSubject
  const allSlots: any[] = [];
  const classColorMap: Record<string, ReturnType<typeof subjectColor>> = {};
  let ci = 0;

  for (const cs of classSubjects) {
    const className = cs.class?.nom ?? '?';
    if (!classColorMap[className]) {
      classColorMap[className] = subjectColor(ci);
      ci++;
    }
    for (const s of (cs.schedules ?? [])) {
      allSlots.push({ ...s, classSubject: cs, color: classColorMap[className] });
    }
  }

  // Grouper par jour
  const byDay: Record<number, any[]> = {};
  for (let d = 1; d <= 6; d++) byDay[d] = [];
  for (const s of allSlots) {
    if (s.jour >= 1 && s.jour <= 6) byDay[s.jour].push(s);
  }
  for (const d of Object.values(byDay)) {
    d.sort((a: any, b: any) => a.heureDebut.localeCompare(b.heureDebut));
  }

  const activeDays = Object.entries(byDay).filter(([, slots]) => slots.length > 0);

  // Résumé semaine
  const totalSlots   = allSlots.length;
  const todaySlots   = byDay[today]?.length ?? 0;
  const totalClasses = new Set(classSubjects.map((cs: any) => cs.class?.id)).size;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Mon emploi du temps</h1>
        <p className="text-[var(--tx-muted)] text-sm mt-0.5">
          {totalSlots} créneaux · {totalClasses} classe(s)
        </p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center py-4">
          <p className="text-3xl font-black text-[var(--tx-primary)]">{totalClasses}</p>
          <p className="text-xs text-[var(--tx-muted)] mt-1">Classes</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-black text-[var(--ok)]">{totalSlots}</p>
          <p className="text-xs text-[var(--tx-muted)] mt-1">Cours / semaine</p>
        </div>
        <div className="card text-center py-4">
          <p className={`text-3xl font-black ${todaySlots > 0 ? 'text-[var(--warn)]' : 'text-[var(--tx-muted)]'}`}>
            {todaySlots}
          </p>
          <p className="text-xs text-[var(--tx-muted)] mt-1">Aujourd'hui</p>
        </div>
      </div>

      {/* Légende classes */}
      {Object.entries(classColorMap).length > 0 && (
        <div className="card p-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-[var(--tx-muted)] uppercase tracking-wide">Légende :</span>
          {Object.entries(classColorMap).map(([name, color]) => (
            <span key={name} className={`badge border ${color} text-xs`}>{name}</span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : allSlots.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <Calendar size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Aucun créneau configuré</p>
          <p className="text-sm mt-1">Contactez l'administrateur pour configurer votre emploi du temps</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((jour) => {
            const isToday = jour === today;
            const slots   = byDay[jour] ?? [];
            return (
              <div key={jour}>
                <div className={`text-center py-2 rounded-xl mb-2 text-sm font-bold
                  ${isToday ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-subtle)] text-[var(--tx-secondary)]'}`}>
                  {JOURS[jour]}
                  {isToday && <span className="block text-xs font-normal opacity-80">Aujourd'hui</span>}
                </div>

                {slots.length === 0 ? (
                  <div className="h-20 border-2 border-dashed border-slate-150 rounded-xl
                                  flex items-center justify-center text-[var(--tx-muted)] text-xs">
                    Libre
                  </div>
                ) : (
                  <div className="space-y-2">
                    {slots.map((s: any, i: number) => (
                      <div key={i}
                        className="p-3 rounded-xl"
                        style={{ ...s.color, boxShadow: isToday ? `0 0 0 2px ${s.color.color}55` : undefined }}>
                        <p className="font-bold text-xs leading-tight">
                          {s.classSubject?.subject?.nom}
                        </p>
                        <p className="font-semibold text-xs opacity-70 mt-0.5">
                          {s.classSubject?.class?.nom}
                        </p>
                        <p className="text-xs font-mono opacity-60 mt-1">
                          {s.heureDebut}–{s.heureFin}
                        </p>
                        {s.salle && (
                          <p className="text-xs opacity-50 mt-0.5">Salle {s.salle}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Vue samedi si créneaux */}
      {(byDay[6]?.length ?? 0) > 0 && (
        <div className="card">
          <h3 className="font-bold text-[var(--tx-secondary)] mb-3">{JOURS[6]}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {byDay[6].map((s: any, i: number) => (
              <div key={i} className="p-3 rounded-xl" style={s.color}>
                <p className="font-bold text-xs">{s.classSubject?.subject?.nom}</p>
                <p className="text-xs opacity-70">{s.classSubject?.class?.nom}</p>
                <p className="text-xs font-mono opacity-60 mt-1">{s.heureDebut}–{s.heureFin}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
