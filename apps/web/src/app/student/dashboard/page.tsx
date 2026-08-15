'use client';

import { useQuery } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { STUDENT_DASHBOARD_QUERY } from '@/lib/graphql/queries';
import {
  TrendingUp, UserCheck, Calendar, Megaphone,
  AlertTriangle, CheckCircle, Clock
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { chartColors } from '@/lib/chartColors';


const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function NoteBar({ valeur }: { valeur: number }) {
  const pct = (valeur / 20) * 100;
  const color = valeur >= 14 ? 'bg-[var(--ok-bg)]0' : valeur >= 10 ? 'bg-[var(--warn-bg)]0' : 'bg-[var(--err-bg)]0';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold w-12 text-right
        ${valeur >= 14 ? 'text-[var(--ok)]' : valeur >= 10 ? 'text-[var(--warn)]' : 'text-[var(--err)]'}`}>
        {valeur.toFixed(2)}
      </span>
    </div>
  );
}

export default function StudentDashboardPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const { data, loading } = useQuery(STUDENT_DASHBOARD_QUERY, {
    variables: { schoolId }, skip: !schoolId,
    pollInterval: 30_000,
  });

  const dash = data?.studentDashboard;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
    </div>
  );

  const today = new Date().getDay();
  const todaySchedule = (dash?.upcomingSchedule ?? []).filter((s: any) => s.jour === today);
  const recentAbsences = dash?.recentAbsences ?? [];
  const recentGradesForAvg = dash?.recentGrades ?? [];
  const avgGrade = recentGradesForAvg.length
    ? recentGradesForAvg.reduce((a: number, g: any) => a + parseFloat(g.valeur), 0) / recentGradesForAvg.length
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Mon tableau de bord</h1>
        <p className="text-[var(--tx-muted)] text-sm mt-0.5">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Calendar}      color={chartColors.accent}  value={todaySchedule.length} label="Cours aujourd'hui" />
        <StatCard icon={TrendingUp}    color={chartColors.amber}   value={avgGrade !== null ? avgGrade.toFixed(1) : '—'} label="Moyenne récente" />
        <StatCard icon={UserCheck}     color={chartColors.emerald} value={recentAbsences.length === 0 ? 0 : recentAbsences.length} label="Absences récentes" />
        <StatCard icon={Megaphone}     color={chartColors.sky}     value={(dash?.announcements ?? []).length} label="Annonces" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Cours du jour */}
        <div className="card">
          <h3 className="font-bold text-[var(--tx-secondary)] mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-sky-500" /> Cours aujourd'hui
          </h3>
          {todaySchedule.length === 0 ? (
            <p className="text-[var(--tx-muted)] text-sm py-4 text-center">Pas de cours aujourd'hui 🎉</p>
          ) : (
            <div className="space-y-2">
              {todaySchedule.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-[var(--info-bg)]
                                            border border-[var(--bd)] rounded-xl">
                  <div className="text-center flex-shrink-0 w-14">
                    <p className="text-xs font-bold text-[var(--info)]">{s.heureDebut}</p>
                    <p className="text-xs text-sky-400">{s.heureFin}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--tx-primary)] text-sm">
                      {s.classSubject?.subject?.nom}
                    </p>
                    <p className="text-xs text-[var(--tx-muted)]">
                      {s.classSubject?.teacher?.profile?.prenom} {s.classSubject?.teacher?.profile?.nom}
                      {s.salle && <> · Salle {s.salle}</>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dernières notes */}
        <div className="card">
          <h3 className="font-bold text-[var(--tx-secondary)] mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[var(--tx-secondary)]" /> Mes dernières notes
          </h3>
          {(dash?.recentGrades ?? []).length === 0 ? (
            <p className="text-[var(--tx-muted)] text-sm text-center py-4">Aucune note enregistrée</p>
          ) : (
            <div className="space-y-3">
              {(dash?.recentGrades ?? []).map((g: any) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-sm font-semibold text-[var(--tx-secondary)]">
                        {g.classSubject?.subject?.nom}
                      </p>
                      <p className="text-xs text-[var(--tx-muted)]">
                        {g.typeEval} · {g.trimestre} · Coef. {g.classSubject?.coefficient}
                      </p>
                    </div>
                  </div>
                  <NoteBar valeur={parseFloat(g.valeur)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Absences récentes */}
        <div className="card">
          <h3 className="font-bold text-[var(--tx-secondary)] mb-4 flex items-center gap-2">
            <UserCheck size={16} className="text-[var(--err)]" /> Absences récentes
          </h3>
          {(dash?.recentAbsences ?? []).length === 0 ? (
            <div className="flex items-center gap-2 text-[var(--ok)] py-4 justify-center">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">Aucune absence enregistrée</span>
            </div>
          ) : (
            <div className="space-y-2">
              {(dash?.recentAbsences ?? []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3
                                            bg-[var(--err-bg)] border border-[var(--bd)] rounded-xl">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-[var(--err)] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[var(--tx-primary)]">
                        {a.classSubject?.subject?.nom ?? 'Cours'}
                      </p>
                      <p className="text-xs text-[var(--tx-muted)]">
                        {a.motif ? `Motif : ${a.motif}` : 'Non justifiée'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[var(--tx-muted)] flex-shrink-0">
                    {new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Annonces */}
        <div className="card">
          <h3 className="font-bold text-[var(--tx-secondary)] mb-4 flex items-center gap-2">
            <Megaphone size={16} className="text-[var(--warn)]" /> Annonces de l'école
          </h3>
          {(dash?.announcements ?? []).length === 0 ? (
            <p className="text-[var(--tx-muted)] text-sm text-center py-4">Aucune annonce</p>
          ) : (
            <div className="space-y-3">
              {(dash?.announcements ?? []).map((a: any) => (
                <div key={a.id} className="p-3 bg-[var(--warn-bg)] border border-[var(--bd)] rounded-xl">
                  <p className="font-semibold text-[var(--tx-primary)] text-sm">{a.titre}</p>
                  <p className="text-xs text-[var(--tx-secondary)] mt-1 line-clamp-2">{a.contenu}</p>
                  <p className="text-xs text-[var(--tx-muted)] mt-1.5 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(a.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long'
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
