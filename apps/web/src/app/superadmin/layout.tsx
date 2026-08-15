'use client';
import React from 'react';
import { useQuery } from '@apollo/client';
import { ME_QUERY } from '@/lib/graphql/queries';
import { AppShell } from '@/components/layout/AppShell';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { data } = useQuery(ME_QUERY, { pollInterval: 60000 });
  const profile  = data?.me;

  const nav = [{ items: [
    { label: 'Tableau de bord', href: '/superadmin/dashboard', icon: 'LayoutDashboard' },
    { label: 'Établissements',  href: '/superadmin/schools',   icon: 'School' },
    { label: 'Utilisateurs',    href: '/superadmin/users',     icon: 'Users' },
  ]}];

  return (
    <AppShell nav={nav} role="Super Administrateur"
      profile={profile} schoolName="Sulungukutu" memberships={[]}>
      {children}
    </AppShell>
  );
}

