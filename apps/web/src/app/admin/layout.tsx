'use client';
import React from 'react';
import { useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { ME_QUERY, UNREAD_COUNTS_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { FloatingActions } from '@/components/ui/FloatingActions';
import { useSchoolTheme } from '@/hooks/useSchoolTheme';
import { AppShell } from '@/components/layout/AppShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  useSchoolTheme();
  const { data } = useQuery(ME_QUERY, { pollInterval: 30000 });
  const profile  = data?.me;
  const memberships = profile?.memberships ?? [];
  const schoolId    = tokenStorage.getSchoolId() ?? '';
  const schoolName  = memberships.find((m: any) => m.school?.id === schoolId)?.school?.nom ?? '';

  const { data: cnt } = useQuery(UNREAD_COUNTS_QUERY, {
    variables: { schoolId }, skip: !schoolId, pollInterval: 60_000,
  });
  const msgBadge = cnt?.unreadCounts?.messages ?? 0;

  const nav = [
    { group: 'Général', items: [
      { label: 'Tableau de bord', href: '/admin/dashboard',     icon: 'LayoutDashboard' },
    ]},
    { group: 'Gestion', items: [
      { label: 'Classes',         href: '/admin/classes',       icon: 'BookOpen' },
      { label: 'Élèves',          href: '/admin/students',      icon: 'GraduationCap' },
      { label: 'Enseignants',     href: '/admin/teachers',      icon: 'Users' },
      { label: 'Annuaire',        href: '/admin/directory',     icon: 'Search' },
      { label: 'Matières',        href: '/admin/subjects',      icon: 'Layers' },
    ]},
    { group: 'Pédagogie', items: [
      { label: 'Emplois du temps', href: '/admin/schedules',   icon: 'Calendar' },
      { label: 'Calendrier',        href: '/admin/calendar',   icon: 'Calendar' },
      { label: 'Notes',            href: '/admin/grades',      icon: 'TrendingUp' },
      { label: 'Bulletins',        href: '/admin/bulletins',   icon: 'FileText' },
    ]},
    { group: 'Administration', items: [
      { label: 'Paiements',        href: '/admin/payments',    icon: 'CreditCard' },
      { label: 'Annonces',         href: '/admin/announcements',icon: 'Megaphone' },
      { label: 'Messages',         href: '/admin/messages',    icon: 'MessageSquare', badge: msgBadge },
      { label: 'Exports',          href: '/admin/exports',     icon: 'Download' },
      { label: "Journal d'audit",  href: '/admin/audit-log',   icon: 'ClipboardList' },
      { label: 'Paramètres',         href: '/admin/settings',    icon: 'Settings' },
      ...(process.env.NODE_ENV !== 'production' ? [{ label: '📬 Emails DEV', href: 'http://localhost:4000/mail-log', icon: 'Mail', external: true }] : []),
    ]},
  ];

  return (
    <AppShell
      nav={nav} role="Administration"
      profile={profile} schoolId={schoolId} schoolName={schoolName}
      memberships={memberships} msgBadge={msgBadge}
      showSearch onSearch={q => router.push(`/admin/students?q=${encodeURIComponent(q)}`)}
    >
      {children}
      <FloatingActions role="admin" />
    </AppShell>
  );
}
