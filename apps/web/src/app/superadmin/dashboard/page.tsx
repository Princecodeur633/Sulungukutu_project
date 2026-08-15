'use client';

import { SUPER_ADMIN_DASHBOARD_QUERY } from '@/lib/graphql/queries';

import { useQuery } from '@apollo/client';
import { Building2, Users, Plus, ChevronRight, Globe, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminDashboardPage() {
  const { data, loading } = useQuery(SUPER_ADMIN_DASHBOARD_QUERY);
  const dash = data?.superAdminDashboard;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Vue globale</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">
            Tous les établissements sur la plateforme
          </p>
        </div>
        <Link href="/superadmin/schools" className="btn-primary">
          <Plus size={15} /> Créer un établissement
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center py-6">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-3">
            <Building2 size={22} className="text-[var(--tx-secondary)]" />
          </div>
          <p className="text-4xl font-black text-[var(--tx-primary)]">{dash?.totalSchools ?? 0}</p>
          <p className="text-[var(--tx-muted)] text-sm mt-1">Établissements</p>
        </div>
        <div className="card text-center py-6">
          <div className="w-12 h-12 rounded-2xl bg-[var(--info-bg)] flex items-center justify-center mx-auto mb-3">
            <Users size={22} className="text-[var(--info)]" />
          </div>
          <p className="text-4xl font-black text-[var(--tx-primary)]">{dash?.totalProfiles ?? 0}</p>
          <p className="text-[var(--tx-muted)] text-sm mt-1">Profils créés</p>
        </div>
        <div className="card text-center py-6">
          <div className="w-12 h-12 rounded-2xl bg-[var(--ok-bg)] flex items-center justify-center mx-auto mb-3">
            <Globe size={22} className="text-[var(--ok)]" />
          </div>
          <p className="text-4xl font-black text-[var(--ok)]">v1.0</p>
          <p className="text-[var(--tx-muted)] text-sm mt-1">Version plateforme</p>
        </div>
      </div>

      {/* Écoles récentes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--tx-secondary)] flex items-center gap-2">
            <TrendingUp size={16} className="text-violet-500" />
            Établissements récents
          </h3>
          <Link href="/superadmin/schools"
            className="text-sm text-[var(--tx-secondary)] hover:text-[var(--tx-secondary)] font-medium flex items-center gap-1">
            Voir tout <ChevronRight size={14} />
          </Link>
        </div>

        {(dash?.recentSchools ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[var(--tx-muted)]">
            <Building2 size={36} className="mb-3 opacity-40" />
            <p className="font-medium">Aucun établissement créé</p>
            <Link href="/superadmin/schools" className="btn-primary mt-3">
              <Plus size={14} /> Créer le premier établissement
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {(dash?.recentSchools ?? []).map((school: any) => (
              <Link
                key={school.id}
                href={`/superadmin/schools/${school.id}`}
                className="flex items-center gap-4 p-3 rounded-xl border border-[var(--bd)]
                           hover:border-violet-200 hover:bg-[var(--bg-subtle)]/40 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
                  <Building2 size={18} className="text-[var(--tx-secondary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--tx-primary)] text-sm">{school.nom}</p>
                  <p className="text-xs text-[var(--tx-muted)] truncate">{school.adresse ?? school.email ?? school.code}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-mono text-[var(--tx-muted)]">{school.code}</p>
                  <p className="text-xs text-[var(--tx-muted)] mt-0.5">
                    {new Date(school.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <ChevronRight size={15} className="text-[var(--tx-muted)] group-hover:text-violet-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
