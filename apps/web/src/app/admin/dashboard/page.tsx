'use client';
import { useQuery } from '@apollo/client';
import Link from 'next/link';
import {
  Users, GraduationCap, BookOpen, TrendingUp,
  UserCheck, CreditCard, FileText, Activity,
  ChevronRight, Plus, Clock, ArrowUpRight, Target,
} from 'lucide-react';
import { ADMIN_DASHBOARD_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { chartColors } from '@/lib/chartColors';
import { OnboardingBanner } from '@/components/ui/OnboardingBanner';
import { SmartAlerts } from '@/components/ui/SmartAlerts';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, CartesianGrid, RadialBarChart, RadialBar,
  PieChart, Pie,
} from 'recharts';

const AUDIT_LABELS: Record<string,string> = {
  PAYMENT_UPDATED: 'Paiement mis à jour', BULLETIN_GENERATED: 'Bulletins générés',
  BULLETIN_PUBLISHED: 'Bulletin publié', USER_CREATED: 'Utilisateur créé',
  GRADE_CREATED: 'Notes saisies', ATTENDANCE_MARKED: 'Présences marquées',
  ANNOUNCEMENT_CREATED: 'Annonce publiée', USER_INVITED: 'Utilisateur invité',
};

// Avant : couleurs codées en dur (#6366f1, #8b5cf6...) qui ne correspondaient
// même pas exactement aux tokens du design system. Désormais issues de la
// palette unique lib/chartColors.ts, partagée avec les graphiques et les
// StatCards de toute la plateforme.
const QUICK = [
  { label: 'Ajouter un élève',      href: '/admin/students',      icon: GraduationCap, color: chartColors.accent },
  { label: 'Inviter un enseignant', href: '/admin/teachers',      icon: Users,         color: chartColors.violet },
  { label: 'Saisir les notes',      href: '/admin/grades',        icon: TrendingUp,    color: chartColors.sky },
  { label: 'Gérer les paiements',   href: '/admin/payments',      icon: CreditCard,    color: chartColors.amber },
  { label: 'Créer une annonce',     href: '/admin/announcements', icon: Activity,      color: chartColors.emerald },
  { label: 'Générer les bulletins', href: '/admin/bulletins',     icon: FileText,      color: chartColors.rose },
];

function Skeleton({ h = 20, w = '100%', r = 8 }: { h?: number; w?: string|number; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export default function AdminDashboard() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const { data, loading } = useQuery(ADMIN_DASHBOARD_QUERY, {
    variables: { schoolId }, skip: !schoolId, pollInterval: 30_000,
  });
  const dash = data?.adminDashboard;

  const presenceRate = dash?.totalStudents
    ? Math.round(((dash.presentToday ?? 0) / dash.totalStudents) * 100) : 0;
  const paymentRate  = dash?.totalStudents
    ? Math.round(((dash.totalStudents - (dash.unpaidCurrentMonth ?? 0)) / dash.totalStudents) * 100) : 0;

  const absenceData = [
    { name: 'Présents', value: dash?.presentToday ?? 0, fill: '#10b981' },
    { name: 'Absents',  value: dash?.absentToday  ?? 0, fill: '#ef4444' },
  ];

  const classData = (dash?.classPerformance ?? [])
    .filter((c: any) => parseFloat(c.moyenneGenerale) > 0)
    .map((c: any) => ({
      name: c.class?.nom?.replace(/^(Terminale|Première|Seconde|CM|CE|CP|)\s*/i, '') || c.class?.nom,
      moy:  parseFloat(c.moyenneGenerale),
    }))
    .slice(0, 8);

  const gradeEvolution = dash?.gradeEvolution ?? [];
  const mentionData    = dash?.mentionDistribution ?? [];

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const greetingEmoji = hour < 6 ? '🌙' : hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx-primary)', letterSpacing: '-.03em' }}>
            {greeting} 👋
          </h1>
          <p className="page-subtitle">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--tx-muted)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', animation: 'pulse 2s infinite' }} />
          Mis à jour en temps réel
        </div>
      </div>

      <OnboardingBanner
        totalClasses={dash?.totalClasses ?? 0}
        totalStudents={dash?.totalStudents ?? 0}
        totalTeachers={dash?.totalTeachers ?? 0}
      />

      <SmartAlerts dash={dash} />

      {/* KPIs */}
      <div className="grid-4-2-1">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card"><Skeleton h={64} /></div>
          ))
        ) : [
          { href:'/admin/students', icon:GraduationCap, val:dash?.totalStudents??0,      label:'Élèves',      sub:'inscrits',  color:'#6366f1' },
          { href:'/admin/teachers', icon:Users,          val:dash?.totalTeachers??0,      label:'Enseignants', sub:'actifs',    color:'#8b5cf6' },
          { href:'/admin/classes',  icon:BookOpen,       val:dash?.totalClasses??0,       label:'Classes',     sub:'actives',   color:'#0ea5e9' },
          { href:'/admin/payments', icon:CreditCard,     val:dash?.unpaidCurrentMonth??0, label:'Impayés',     sub:'ce mois',   color:'#ef4444' },
        ].map(({ href, icon: Icon, val, label, sub, color }) => (
          <Link key={href} href={href} className="stat-card" style={{ textDecoration: 'none' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: color + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--tx-primary)', letterSpacing: '-.04em', lineHeight: 1 }}>{val}</p>
              <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 2 }}>{label} <span style={{ color: 'var(--bd-strong)' }}>·</span> {sub}</p>
            </div>
            <ArrowUpRight size={14} style={{ color: 'var(--tx-muted)', flexShrink: 0 }} />
          </Link>
        ))}
      </div>

      {/* Row: présences + performances classes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>

        {/* Présences */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              <UserCheck size={15} style={{ color: 'var(--tx-muted)' }} /> Présences aujourd'hui
            </div>
            <Link href="/admin/students" style={{ fontSize: 11, color: 'var(--tx-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              Détail <ChevronRight size={11} />
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
            <div style={{ position: 'relative', width: 72, height: 72 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="62%" outerRadius="100%" data={[{ value: presenceRate, fill: 'url(#presenceGradient)' }]} startAngle={90} endAngle={-270}>
                  <defs>
                    <linearGradient id="presenceGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%"  stopColor={presenceRate >= 80 ? '#34d399' : presenceRate >= 60 ? '#fbbf24' : '#f87171'} />
                      <stop offset="100%" stopColor={presenceRate >= 80 ? '#059669' : presenceRate >= 60 ? '#d97706' : '#dc2626'} />
                    </linearGradient>
                  </defs>
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'var(--bg-subtle)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx-primary)' }}>{presenceRate}%</span>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Présents', val: dash?.presentToday ?? 0, color: 'var(--ok)' },
                { label: 'Absents',  val: dash?.absentToday  ?? 0, color: 'var(--err)' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--tx-muted)', flex: 1 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.val}</span>
                </div>
              ))}
              <p style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 4 }}>
                Sur {dash?.totalStudents ?? 0} élèves
              </p>
            </div>
          </div>
        </div>

        {/* Performances par classe */}
        <div className="card" style={{ gridColumn: 'span 3' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              <Target size={15} style={{ color: 'var(--tx-muted)' }} /> Performances par classe
            </div>
            <Link href="/admin/grades" style={{ fontSize: 11, color: 'var(--tx-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              Notes <ChevronRight size={11} />
            </Link>
          </div>
          {classData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={classData} barSize={24} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="barMid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                  <linearGradient id="barLow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" /><stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--tx-muted)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: 'var(--tx-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--bg-subtle)' }}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px -6px rgba(0,0,0,.18)', padding: '8px 12px' }}
                  formatter={(v: any) => [v + '/20', 'Moyenne']}
                />
                <Bar dataKey="moy" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700}>
                  {classData.map((c: any, i: number) => (
                    <Cell key={i} fill={c.moy >= 14 ? 'url(#barGood)' : c.moy >= 10 ? 'url(#barMid)' : 'url(#barLow)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-muted)', fontSize: 13 }}>
              Aucune note enregistrée
            </div>
          )}
        </div>
      </div>


      {(gradeEvolution.length > 0 || mentionData.length > 0) && (
        <div className="grid-2-1">
          {gradeEvolution.length > 0 && (
            <div className="card">
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
                <div className="section-title" style={{ marginBottom:0 }}>
                  <TrendingUp size={15} style={{ color:'var(--tx-muted)' }} /> Evolution des moyennes
                </div>
                <span style={{ fontSize:11,color:'var(--tx-muted)' }}>Bulletins publies</span>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={gradeEvolution} margin={{ top:4,right:8,left:-24,bottom:0 }}>
                  <defs>
                    <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lineStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                  <XAxis dataKey="trimestre" tick={{ fontSize:11,fill:'var(--tx-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,20]} tick={{ fontSize:10,fill:'var(--tx-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background:'var(--bg-card)',border:'1px solid var(--bd)',borderRadius:10,fontSize:12,boxShadow:'0 8px 24px -6px rgba(0,0,0,.18)',padding:'8px 12px' }}
                    formatter={(v: any, _: any, p: any) => [v+'/20 ('+p.payload.nbEleves+' él.)','Moyenne']} />
                  <Area type="monotone" dataKey="moyenne" stroke="url(#lineStrokeGrad)" strokeWidth={3}
                    fill="url(#lineAreaGrad)"
                    dot={{ fill:'#6366f1', r:4, strokeWidth:2, stroke:'var(--bg-card)' }}
                    activeDot={{ r:6, fill:'#6366f1', stroke:'var(--bg-card)', strokeWidth:2 }}
                    isAnimationActive animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {mentionData.length > 0 && (
            <div className="card">
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
                <div className="section-title" style={{ marginBottom:0 }}>
                  <Activity size={15} style={{ color:'var(--tx-muted)' }} /> Distribution des mentions
                </div>
              </div>
              <div style={{ display:'flex',gap:16,alignItems:'center' }}>
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie data={mentionData} dataKey="count" cx="50%" cy="50%" outerRadius={50} innerRadius={28}
                      paddingAngle={3} cornerRadius={4} isAnimationActive animationDuration={700}>
                      {mentionData.map((e: any, i: number) => (<Cell key={i} fill={e.color} stroke="var(--bg-card)" strokeWidth={2} />))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background:'var(--bg-card)',border:'1px solid var(--bd)',borderRadius:10,fontSize:12,boxShadow:'0 8px 24px -6px rgba(0,0,0,.18)',padding:'8px 12px' }}
                      formatter={(v: any, n: any) => [v, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex:1,display:'flex',flexDirection:'column',gap:5 }}>
                  {mentionData.slice(0,5).map((m: any, i: number) => (
                    <div key={i} style={{ display:'flex',alignItems:'center',gap:6 }}>
                      <div style={{ width:8,height:8,borderRadius:2,background:m.color,flexShrink:0 }} />
                      <span style={{ fontSize:11,color:'var(--tx-secondary)',flex:1 }}>{m.mention}</span>
                      <span style={{ fontSize:12,fontWeight:700,color:'var(--tx-primary)' }}>{m.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions rapides */}
      <div className="card">
        <div className="section-title"><Plus size={15} style={{ color: 'var(--tx-muted)' }} />Actions rapides</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
          {QUICK.map(({ label, href, icon: Icon, color }) => (
            <Link key={href} href={href} className="quick-action-card">
              <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Icon size={17} style={{ color }} />
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-secondary)', lineHeight: 1.3, textAlign: 'center' }}>{label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Paiements + Activité */}
      <div className="grid-2-1">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 0 }}><CreditCard size={15} style={{ color: 'var(--tx-muted)' }} />Paiements ce mois</div>
            <Link href="/admin/payments" style={{ fontSize: 11, color: 'var(--tx-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              Gérer <ChevronRight size={11} />
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--tx-primary)', letterSpacing: '-.04em', lineHeight: 1 }}>{paymentRate}</span>
              <span style={{ fontSize: 16, color: 'var(--tx-muted)' }}>%</span>
              <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 4 }}>Recouvrement</p>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--tx-muted)' }}>Payés</span>
                <span style={{ fontWeight: 700, color: 'var(--ok)' }}>
                  {dash?.totalStudents ? dash.totalStudents - (dash.unpaidCurrentMonth ?? 0) : 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--tx-muted)' }}>Impayés</span>
                <span style={{ fontWeight: 700, color: 'var(--err)' }}>{dash?.unpaidCurrentMonth ?? 0}</span>
              </div>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{
              width: `${paymentRate}%`,
              background: paymentRate >= 80 ? 'var(--ok)' : paymentRate >= 60 ? 'var(--warn)' : 'var(--err)',
            }} />
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 0 }}><Clock size={15} style={{ color: 'var(--tx-muted)' }} />Activité récente</div>
            <Link href="/admin/audit-log" style={{ fontSize: 11, color: 'var(--tx-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              Journal <ChevronRight size={11} />
            </Link>
          </div>
          {(dash?.recentAuditLogs ?? []).length === 0 ? (
            <p style={{ color: 'var(--tx-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              Aucune activité récente
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(dash.recentAuditLogs).slice(0, 6).map((a: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {AUDIT_LABELS[a.action] ?? a.action}
                    </p>
                    {a.description && (
                      <p style={{ fontSize: 11, color: 'var(--tx-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.description}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--tx-muted)', flexShrink: 0 }}>
                    {new Date(a.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
