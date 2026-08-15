'use client';

import { MY_STUDENT_PROFILE_QUERY, SCHEDULE_BY_CLASS_QUERY } from '@/lib/graphql/queries';

import { useQuery } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { Calendar } from 'lucide-react';
import { chartSeries } from '@/lib/chartColors';

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
function subjectColor(index: number) {
  const hex = chartSeries[index % chartSeries.length];
  return { background: `${hex}1a`, color: hex, border: `1px solid ${hex}33` };
}

export default function StudentSchedulePage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const today    = new Date().getDay();

  const { data: profileData } = useQuery(MY_STUDENT_PROFILE_QUERY, {
    variables: { schoolId }, skip: !schoolId,
  });
  const classId = profileData?.myStudentProfile?.class?.id;

  const { data, loading } = useQuery(SCHEDULE_BY_CLASS_QUERY, {
    variables: { classId }, skip: !classId,
  });

  const schedules = data?.scheduleByClass ?? [];

  // Couleur stable par matière
  const subjectColorMap: Record<string, ReturnType<typeof subjectColor>> = {};
  let colorIdx = 0;
  for (const s of schedules) {
    const name = s.classSubject?.subject?.nom;
    if (name && !subjectColorMap[name]) {
      subjectColorMap[name] = subjectColor(colorIdx);
      colorIdx++;
    }
  }

  // Grouper par jour (1=Lundi → 6=Samedi)
  const byDay: Record<number, any[]> = {};
  for (let d = 1; d <= 6; d++) byDay[d] = [];
  for (const s of schedules) {
    if (s.jour >= 1 && s.jour <= 6) byDay[s.jour].push(s);
  }
  for (const d of Object.values(byDay)) {
    d.sort((a: any, b: any) => a.heureDebut.localeCompare(b.heureDebut));
  }

  const activeDays = Object.entries(byDay).filter(([, slots]) => slots.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Emploi du temps</h1>
        <p className="text-[var(--tx-muted)] text-sm mt-0.5">{schedules.length} cours programmés</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <Calendar size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Aucun emploi du temps configuré</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeDays.map(([jour, slots]) => {
            const jourNum = Number(jour);
            const isToday = jourNum === today;
            return (
              <div key={jour}
                className={`card ${isToday ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-bold text-base
                    ${isToday ? 'text-[var(--tx-primary)]' : 'text-[var(--tx-secondary)]'}`}>
                    {JOURS[jourNum]}
                  </h3>
                  {isToday && (
                    <span className="badge badge-info text-xs">Aujourd'hui</span>
                  )}
                </div>
                <div className="space-y-2">
                  {slots.map((s: any) => {
                    const color = subjectColorMap[s.classSubject?.subject?.nom] ?? subjectColor(0);
                    return (
                      <div key={s.id}
                        className="p-3 rounded-xl" style={color}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm">
                            {s.classSubject?.subject?.nom}
                          </p>
                          <span className="text-xs font-mono flex-shrink-0">
                            {s.heureDebut}–{s.heureFin}
                          </span>
                        </div>
                        <p className="text-xs opacity-70 mt-0.5">
                          {s.classSubject?.teacher?.profile?.prenom} {s.classSubject?.teacher?.profile?.nom}
                          {s.salle && <> · Salle {s.salle}</>}
                        </p>
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
  );
}
