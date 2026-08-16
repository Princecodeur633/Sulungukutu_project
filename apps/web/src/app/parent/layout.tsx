'use client';
import React from 'react';
import { useQuery } from '@apollo/client';
import { ME_QUERY, UNREAD_COUNTS_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { AppShell } from '@/components/layout/AppShell';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const { data } = useQuery(ME_QUERY, { pollInterval: 60000 });
  const profile  = data?.me;
  const memberships = profile?.memberships ?? [];
  const schoolId    = tokenStorage.getSchoolId() ?? '';
  const schoolName  = memberships.find((m: any) => m.school?.id === schoolId)?.school?.nom ?? '';

  const { data: cnt } = useQuery(UNREAD_COUNTS_QUERY, {
    variables: { schoolId }, skip: !schoolId, pollInterval: 60_000,
  });
  const msgBadge   = cnt?.unreadMessageCount      ?? 0;
  const notifBadge = cnt?.unreadNotificationCount ?? 0;

  const nav = [{ items: [
    { label: 'Tableau de bord', href: '/parent/dashboard',      icon: 'LayoutDashboard' },
    { label: 'Mes enfants',     href: '/parent/children',       icon: 'Heart' },
    { label: 'Messages',        href: '/parent/messages',       icon: 'MessageSquare', badge: msgBadge },
    { label: 'Notifications',   href: '/parent/notifications',  icon: 'Bell', badge: notifBadge },
  ]}];

  return (
    <AppShell nav={nav} role="Parent"
      profile={profile} schoolId={schoolId} schoolName={schoolName}
      memberships={memberships}>
      {children}
    </AppShell>
  );
}
