'use client';
import React from 'react';
import { useQuery } from '@apollo/client';
import { ME_QUERY, UNREAD_COUNTS_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { FloatingActions } from '@/components/ui/FloatingActions';
import { AppShell } from '@/components/layout/AppShell';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { data } = useQuery(ME_QUERY, { pollInterval: 30000 });
  const profile  = data?.me;
  const memberships = profile?.memberships ?? [];
  const schoolId    = tokenStorage.getSchoolId() ?? '';
  const schoolName  = memberships.find((m: any) => m.school?.id === schoolId)?.school?.nom ?? '';

  const { data: cnt } = useQuery(UNREAD_COUNTS_QUERY, {
    variables: { schoolId }, skip: !schoolId, pollInterval: 60_000,
  });
  const msgBadge   = cnt?.unreadCounts?.messages      ?? 0;
  const notifBadge = cnt?.unreadCounts?.notifications ?? 0;

  const nav = [{ items: [
    { label: 'Tableau de bord', href: '/teacher/dashboard',     icon: 'LayoutDashboard' },
    { label: 'Mes classes',     href: '/teacher/classes',       icon: 'BookOpen' },
    { label: 'Saisie des notes',href: '/teacher/grades',        icon: 'ClipboardList' },
    { label: 'Emploi du temps', href: '/teacher/schedule',      icon: 'Calendar' },
    { label: 'Bulletins',       href: '/teacher/bulletins',     icon: 'FileText' },
    { label: 'Messages',        href: '/teacher/messages',      icon: 'MessageSquare', badge: msgBadge },
    { label: 'Notifications',   href: '/teacher/notifications', icon: 'Bell', badge: notifBadge },
  ]}];

  return (
    <AppShell nav={nav} role="Enseignant"
      profile={profile} schoolId={schoolId} schoolName={schoolName}
      memberships={memberships} msgBadge={msgBadge}>
      {children}
    </AppShell>
  );
}
