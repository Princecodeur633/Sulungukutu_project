'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { ChevronDown, Building2, Check, Plus } from 'lucide-react';
import { SWITCH_WORKSPACE_MUTATION, ME_QUERY } from '@/lib/graphql/queries';
import { tokenStorage, apolloClient } from '@/lib/apollo/client';
import { useRouter } from 'next/navigation';

interface Membership {
  id:     string;
  role:   string;
  code:   string;
  status: string;
  school: { id: string; nom: string; logoUrl?: string };
}

interface WorkspaceSwitcherProps {
  currentSchoolId:   string;
  currentSchoolName: string;
  memberships:       Membership[];
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Administrateur',
  TEACHER:     'Enseignant',
  PARENT:      'Parent',
  STUDENT:     'Élève',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN:   'bg-[var(--info-bg)] text-[var(--tx-primary)]',
  TEACHER: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  PARENT:  'bg-[var(--warn-bg)] text-[var(--warn)]',
  STUDENT: 'bg-[var(--info-bg)] text-[var(--info)]',
};

export function WorkspaceSwitcher({
  currentSchoolId,
  currentSchoolName,
  memberships,
}: WorkspaceSwitcherProps) {
  const [open, setOpen]   = useState(false);
  const router            = useRouter();
  const [switchWorkspace] = useMutation(SWITCH_WORKSPACE_MUTATION);

  const handleSwitch = async (schoolId: string, role: string) => {
    if (schoolId === currentSchoolId) {
      setOpen(false);
      return;
    }

    try {
      const { data } = await switchWorkspace({ variables: { schoolId } });
      if (data?.switchWorkspace?.accessToken) {
        // Purge le cache Apollo : les données affichées appartiennent au
        // contexte de l'ancien établissement (schoolId différent) et ne
        // doivent pas persister lors du changement d'espace de travail.
        await apolloClient.clearStore();
        tokenStorage.set(data.switchWorkspace.accessToken);
        tokenStorage.setSchoolId(schoolId);

        // Rediriger vers le bon dashboard selon le rôle
        // (NB: la route Super-Administrateur est "/superadmin/...", pas "/super/...")
        const dashboardMap: Record<string, string> = {
          SUPER_ADMIN: '/superadmin/dashboard',
          ADMIN:       '/admin/dashboard',
          TEACHER:     '/teacher/dashboard',
          PARENT:      '/parent/dashboard',
          STUDENT:     '/student/dashboard',
        };

        router.push(dashboardMap[role] ?? '/');
        setOpen(false);
      }
    } catch (err) {
      console.error('Erreur switch workspace:', err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg
                   border border-[var(--bd)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)]
                   transition-all duration-150 text-sm font-medium text-[var(--tx-secondary)]
                   shadow-sm min-w-48"
      >
        <div className="w-6 h-6 rounded bg-[var(--info-bg)] flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-[var(--tx-primary)]" />
        </div>
        <span className="flex-1 truncate text-left">{currentSchoolName}</span>
        <ChevronDown
          size={15}
          className={`text-[var(--tx-muted)] flex-shrink-0 transition-transform duration-150
                      ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-2 w-72 bg-[var(--bg-card)] rounded-xl
                          border border-[var(--bd)] shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--bd)]">
              <p className="text-xs font-semibold text-[var(--tx-muted)] uppercase tracking-wider">
                Mes établissements
              </p>
            </div>

            <div className="py-1 max-h-64 overflow-y-auto">
              {memberships.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSwitch(m.school.id, m.role)}
                  disabled={m.status !== 'ACTIVE'}
                  className="w-full flex items-center gap-3 px-4 py-3
                             hover:bg-[var(--bg-subtle)] transition-colors duration-100
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Logo/Initiale */}
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br
                                  from-indigo-500 to-purple-600 flex-shrink-0
                                  flex items-center justify-center">
                    {m.school.logoUrl ? (
                      <img
                        src={m.school.logoUrl}
                        alt={m.school.nom}
                        className="w-full h-full rounded-lg object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-sm">
                        {m.school.nom.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-[var(--tx-primary)] truncate">
                      {m.school.nom}
                    </p>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded
                                     ${ROLE_COLORS[m.role] ?? 'bg-[var(--bg-subtle)] text-[var(--tx-secondary)]'}`}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  </div>

                  {/* Check actif */}
                  {m.school.id === currentSchoolId && (
                    <Check size={16} className="text-[var(--tx-primary)] flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Rejoindre une école */}
            <div className="px-4 py-3 border-t border-[var(--bd)]">
              <button className="flex items-center gap-2 text-sm text-[var(--tx-primary)]
                                 font-medium hover:text-indigo-800 transition-colors">
                <Plus size={15} />
                Rejoindre un autre établissement
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
