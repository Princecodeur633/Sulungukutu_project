'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Users, GraduationCap, CheckCircle2, X, ArrowRight } from 'lucide-react';

interface Props { totalClasses: number; totalStudents: number; totalTeachers: number; }

const STEPS = [
  { label: 'Créer vos classes',       href: '/admin/classes',   icon: BookOpen,      key: 'classes' as const },
  { label: 'Inviter vos enseignants', href: '/admin/teachers',  icon: Users,         key: 'teachers' as const },
  { label: 'Inscrire vos élèves',     href: '/admin/students',  icon: GraduationCap, key: 'students' as const },
];

export function OnboardingBanner({ totalClasses, totalStudents, totalTeachers }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const done = {
    classes:  totalClasses  > 0,
    teachers: totalTeachers > 0,
    students: totalStudents > 0,
  };

  const doneCount = Object.values(done).filter(Boolean).length;
  if (doneCount >= 3 || dismissed) return null;

  const pct = Math.round((doneCount / 3) * 100);

  return (
    <div style={{
      background:'var(--bg-card)', border:'1px solid var(--bd)',
      borderRadius:16, padding:20, position:'relative',
      boxShadow:'var(--sh-sm)', overflow:'hidden',
    }} className="animate-slide-up">
      {/* Subtle top stripe */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'var(--tx-primary)', borderRadius:'16px 16px 0 0' }} />

      <button onClick={() => setDismissed(true)} style={{
        position:'absolute', top:14, right:14, background:'none', border:'none',
        cursor:'pointer', padding:4, borderRadius:6, color:'var(--tx-muted)', transition:'all .15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.background='var(--bg-subtle)'; e.currentTarget.style.color='var(--tx-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--tx-muted)'; }}
      ><X size={14} /></button>

      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <div>
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--tx-primary)' }}>Configurer votre établissement</h3>
          <p style={{ fontSize:12, color:'var(--tx-muted)', marginTop:2 }}>{doneCount}/3 étapes complétées</p>
        </div>
        <div style={{ marginLeft:'auto', textAlign:'right' }}>
          <span style={{ fontSize:22, fontWeight:800, color:'var(--tx-primary)', letterSpacing:'-.04em' }}>{pct}%</span>
        </div>
      </div>

      <div style={{ height:4, borderRadius:99, background:'var(--bg-subtle)', marginBottom:16, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:99, background:'var(--tx-primary)', width:`${pct}%`, transition:'width .5s ease' }} />
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {STEPS.map(({ label, href, icon: Icon, key }) => {
          const isDone = done[key];
          const isNext = !isDone && STEPS.filter(s => !done[s.key])[0]?.key === key;
          return (
            <Link key={key} href={href} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 12px', borderRadius:10, textDecoration:'none',
              background: isNext ? 'var(--bg-subtle)' : 'transparent',
              border: `1px solid ${isNext ? 'var(--bd-strong)' : 'transparent'}`,
              transition:'all .15s', opacity: isDone ? .7 : 1,
            }}
              onMouseEnter={e => { if (!isDone) { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.borderColor='var(--bd-strong)'; }}}
              onMouseLeave={e => { e.currentTarget.style.background = isNext ? 'var(--bg-subtle)' : 'transparent'; e.currentTarget.style.borderColor = isNext ? 'var(--bd-strong)' : 'transparent'; }}
            >
              <div style={{
                width:32, height:32, borderRadius:8, flexShrink:0,
                background: isDone ? 'var(--ok-bg)' : 'var(--bg-card)',
                border:'1px solid var(--bd)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {isDone
                  ? <CheckCircle2 size={16} style={{ color:'var(--ok)' }} />
                  : <Icon size={15} style={{ color:'var(--tx-secondary)' }} />}
              </div>
              <span style={{ fontSize:13, fontWeight:isDone?500:600, color: isDone ? 'var(--tx-muted)' : 'var(--tx-primary)', flex:1, textDecoration: isDone ? 'line-through' : 'none' }}>
                {label}
              </span>
              {isNext && <ArrowRight size={14} style={{ color:'var(--tx-muted)', flexShrink:0 }} />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
