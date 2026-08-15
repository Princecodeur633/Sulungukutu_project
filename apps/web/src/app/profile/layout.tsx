'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { tokenStorage } from '@/lib/apollo/client';
import { ThemeToggle } from '@/components/ui/ThemeProvider';

function getDashboard(): string {
  try {
    const t = tokenStorage.getToken();
    if (!t) return '/auth/login';
    const p = JSON.parse(atob(t.split('.')[1]));
    const map: Record<string,string> = {
      SUPER_ADMIN: '/superadmin/dashboard', ADMIN: '/admin/dashboard',
      TEACHER: '/teacher/dashboard', PARENT: '/parent/dashboard', STUDENT: '/student/dashboard',
    };
    return map[p.role] ?? '/auth/login';
  } catch { return '/auth/login'; }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <header style={{
        height: 52, background: 'var(--bg-card)', borderBottom: '1px solid var(--bd)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Link href={getDashboard()} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-muted)', fontSize: 13, transition: 'color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--tx-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx-muted)')}>
          <ArrowLeft size={15} />
          <span>Retour</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}>
          <GraduationCap size={16} style={{ color: 'var(--tx-muted)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-primary)' }}>Mon profil</span>
        </div>
        <ThemeToggle />
      </header>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>
    </div>
  );
}
