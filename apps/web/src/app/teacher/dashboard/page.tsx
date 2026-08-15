'use client';
import { useQuery } from '@apollo/client';
import { TEACHER_DASHBOARD_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { BookOpen, CheckSquare, Users, Clock, TrendingUp, ChevronRight, Calendar, Award, AlertTriangle, UserX, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { chartColors } from '@/lib/chartColors';

const JOURS = ['','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const MOIS  = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

function NoteChip({ v }: { v: number }) {
  const color = v >= 14 ? 'var(--ok)' : v >= 10 ? 'var(--warn)' : 'var(--err)';
  const bg    = v >= 14 ? 'var(--ok-bg)' : v >= 10 ? 'var(--warn-bg)' : 'var(--err-bg)';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: bg, color, whiteSpace: 'nowrap' }}>
      {v.toFixed(1)}/20
    </span>
  );
}

export default function TeacherDashboard() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const { data, loading } = useQuery(TEACHER_DASHBOARD_QUERY, { variables: { schoolId }, skip: !schoolId });
  const dash = data?.teacherDashboard;

  const today = new Date(); const todayDay = today.getDay();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const todayCourses   = dash?.classSubjectsToday ?? [];
  const myClasses      = dash?.myClasses          ?? [];
  const recentGrades   = dash?.recentGrades       ?? [];
  const pendingAtt     = dash?.pendingAttendance   ?? [];
  const weeklyAbs      = dash?.weeklyAbsences      ?? [];
  const atRisk         = dash?.studentsAtRisk      ?? [];
  const totalStudents  = dash?.totalStudents       ?? 0;
  const avgGrade       = recentGrades.length ? recentGrades.reduce((a: number, g: any) => a + parseFloat(g.valeur), 0) / recentGrades.length : null;

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:240 }}><div className="spinner spinner-lg" /></div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 className="page-title">{greeting} 👋</h1>
          <p className="page-subtitle">{JOURS[todayDay]} {today.getDate()} {MOIS[today.getMonth()]} {today.getFullYear()}</p>
        </div>
        <Link href="/teacher/classes" className="btn-primary"><span>Mes classes</span><ArrowRight size={14} /></Link>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }} className="lg:grid-cols-4">
        <StatCard icon={Calendar}  color={chartColors.accent}  value={todayCourses.length} label="Cours aujourd'hui" />
        <StatCard icon={BookOpen}  color={chartColors.sky}     value={myClasses.length}    label="Classes" />
        <StatCard icon={Users}     color={chartColors.emerald} value={totalStudents}       label="Élèves" />
        <StatCard icon={Award}     color={chartColors.amber}   value={avgGrade !== null ? avgGrade.toFixed(1) : '—'} label="Moy. notes récentes" />
      </div>
      {pendingAtt.length > 0 && (
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn)', marginTop: -12 }}>
          {pendingAtt.length} présence(s) à saisir aujourd'hui
        </p>
      )}

      {/* Cours du jour + Graphique */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }} className="lg:grid-cols-2">
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div className="section-title" style={{ marginBottom:0 }}><Calendar size={15} style={{ color:'var(--tx-muted)' }} />Cours du jour</div>
            {pendingAtt.length > 0 && <span className="badge badge-warning">{pendingAtt.length} présence(s) à saisir</span>}
          </div>
          {todayCourses.length === 0 ? (
            <div className="empty-state" style={{ padding:'32px 0' }}>
              <Calendar size={32} className="empty-state-icon" />
              <p style={{ fontSize:13, fontWeight:600 }}>Pas de cours aujourd'hui 🎉</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {todayCourses.map((cs: any) => {
                const slot = (cs.schedules??[]).find((s: any) => s.jour === todayDay);
                return (
                  <Link key={cs.id} href="/teacher/classes" style={{
                    display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                    borderRadius:10, border:'1px solid var(--bd)', textDecoration:'none',
                    transition:'all .15s', background:'var(--bg-card)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--bg-subtle)'; e.currentTarget.style.borderColor='var(--bd-strong)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='var(--bg-card)'; e.currentTarget.style.borderColor='var(--bd)'; }}
                  >
                    <div style={{ width:36, height:36, borderRadius:8, background:'var(--bg-subtle)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <BookOpen size={15} style={{ color:'var(--tx-secondary)' }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:'var(--tx-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cs.subject?.nom}</p>
                      <p style={{ fontSize:11, color:'var(--tx-muted)' }}>
                        {cs.class?.nom}{slot && ` · ${slot.heureDebut}–${slot.heureFin}${slot.salle ? ` · ${slot.salle}` : ''}`}
                      </p>
                    </div>
                    <CheckSquare size={13} style={{ color:'var(--tx-muted)', flexShrink:0 }} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title"><TrendingUp size={15} style={{ color:'var(--tx-muted)' }} />Absences cette semaine</div>
          {weeklyAbs.every((d: any) => d.total === 0) ? (
            <div className="empty-state" style={{ padding:'32px 0' }}>
              <TrendingUp size={32} className="empty-state-icon" />
              <p style={{ fontSize:13, fontWeight:600 }}>Aucune donnée</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={weeklyAbs} barSize={28} margin={{ top:0,right:0,left:-20,bottom:0 }}>
                <defs>
                  <linearGradient id="absHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" /><stop offset="100%" stopColor={chartColors.rose} />
                  </linearGradient>
                  <linearGradient id="absMid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor={chartColors.amber} />
                  </linearGradient>
                  <linearGradient id="absLow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor={chartColors.emerald} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="jour" tick={{ fontSize:12, fill:'var(--tx-muted)' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--bd)', borderRadius:10, fontSize:12, boxShadow:'0 8px 24px -6px rgba(0,0,0,.18)', padding:'8px 12px' }} cursor={{ fill:'var(--bg-subtle)' }} />
                <Bar dataKey="absences" radius={[6,6,0,0]} isAnimationActive animationDuration={700}>
                  {weeklyAbs.map((e: any, i: number) => {
                    const r = e.total > 0 ? e.absences/e.total : 0;
                    return <Cell key={i} fill={r > .1 ? 'url(#absHigh)' : r > .05 ? 'url(#absMid)' : 'url(#absLow)'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Élèves à risque + Notes récentes */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }} className="lg:grid-cols-2">
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div className="section-title" style={{ marginBottom:0 }}><AlertTriangle size={15} style={{ color:'var(--err)' }} />Élèves en difficulté</div>
            <Link href="/teacher/classes" style={{ fontSize:12, color:'var(--tx-muted)', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>Voir classes <ChevronRight size={12} /></Link>
          </div>
          {atRisk.length === 0 ? (
            <div className="empty-state" style={{ padding:'28px 0' }}>
              <UserX size={32} className="empty-state-icon" />
              <p style={{ fontSize:13, fontWeight:600 }}>Aucun élève à risque 🎉</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {atRisk.map((s: any, i: number) => {
                const p = s.student?.membership?.profile;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'var(--err-bg)', border:'1px solid var(--bd)' }}>
                    <div style={{ width:30, height:30, borderRadius:8, background:'var(--bg-card)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--tx-secondary)', flexShrink:0 }}>
                      {p?.prenom?.[0] ?? '?'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:600, color:'var(--tx-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p?.prenom} {p?.nom}</p>
                      <p style={{ fontSize:11, color:'var(--tx-muted)' }}>{s.student?.class?.nom}{s.absenceCount > 0 && ` · ${s.absenceCount} abs.`}</p>
                    </div>
                    <NoteChip v={s.moyenne} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div className="section-title" style={{ marginBottom:0 }}><Award size={15} style={{ color:'var(--tx-muted)' }} />Dernières notes</div>
            <Link href="/teacher/classes" style={{ fontSize:12, color:'var(--tx-muted)', display:'flex', alignItems:'center', gap:4, textDecoration:'none' }}>Saisir <ChevronRight size={12} /></Link>
          </div>
          {recentGrades.length === 0 ? (
            <div className="empty-state" style={{ padding:'28px 0' }}><Award size={32} className="empty-state-icon" /><p style={{ fontSize:13, fontWeight:600 }}>Aucune note saisie</p></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {recentGrades.slice(0,7).map((g: any) => {
                const p = g.student?.membership?.profile; const d = new Date(g.dateSaisie);
                return (
                  <div key={g.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--bd)' }}>
                    <div style={{ width:26, height:26, borderRadius:7, background:'var(--bg-subtle)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'var(--tx-secondary)', flexShrink:0 }}>
                      {p?.prenom?.[0]??'?'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:600, color:'var(--tx-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p?.prenom} {p?.nom}</p>
                      <p style={{ fontSize:11, color:'var(--tx-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.classSubject?.subject?.nom} · {g.typeEval} · {g.trimestre}</p>
                    </div>
                    <NoteChip v={parseFloat(g.valeur)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actions rapides */}
      <div className="card">
        <div className="section-title"><Clock size={14} style={{ color:'var(--tx-muted)' }} />Actions rapides</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }} className="md:grid-cols-4">
          {[
            { href:'/teacher/classes',  icon:CheckSquare, label:'Prendre les présences' },
            { href:'/teacher/classes',  icon:TrendingUp,  label:'Saisir des notes' },
            { href:'/teacher/schedule', icon:Calendar,    label:"Emploi du temps" },
            { href:'/teacher/notifications', icon:AlertTriangle, label:'Notifications' },
          ].map(({ href, icon:Icon, label }) => (
            <Link key={label} href={href} style={{
              display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
              borderRadius:10, border:'1px solid var(--bd)', textDecoration:'none', transition:'all .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background='var(--bg-subtle)'; e.currentTarget.style.borderColor='var(--bd-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--bd)'; }}
            >
              <Icon size={15} style={{ color:'var(--tx-secondary)', flexShrink:0 }} />
              <p style={{ fontSize:12, fontWeight:600, color:'var(--tx-secondary)', flex:1 }}>{label}</p>
              <ChevronRight size={12} style={{ color:'var(--tx-muted)' }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
