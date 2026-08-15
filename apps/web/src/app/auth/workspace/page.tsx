'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { Building2, ChevronRight } from 'lucide-react';
import { SWITCH_WORKSPACE_MUTATION } from '@/lib/graphql/queries';
import { tokenStorage, apolloClient } from '@/lib/apollo/client';
import logoImg from '@/img/logo.png';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrateur',
  ADMIN:       'Administrateur',
  TEACHER:     'Enseignant',
  PARENT:      'Parent',
  STUDENT:     'Élève',
};

const ROLE_DASHBOARDS: Record<string, string> = {
  SUPER_ADMIN: '/superadmin/dashboard',
  ADMIN:       '/admin/dashboard',
  TEACHER:     '/teacher/dashboard',
  PARENT:      '/parent/dashboard',
  STUDENT:     '/student/dashboard',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN:   'from-indigo-500 to-indigo-700',
  TEACHER: 'from-emerald-500 to-emerald-700',
  PARENT:  'from-amber-500 to-amber-700',
  STUDENT: 'from-sky-500 to-sky-700',
};

export default function WorkspacePage() {
  const router          = useRouter();
  const [memberships, setMemberships] = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState<string | null>(null);

  const [switchWorkspace] = useMutation(SWITCH_WORKSPACE_MUTATION);

  useEffect(() => {
    const raw = sessionStorage.getItem('pending_memberships');
    if (!raw) {
      router.push('/auth/login');
      return;
    }
    setMemberships(JSON.parse(raw));
  }, []);

  const handleSelect = async (membership: any) => {
    setSelected(membership.id);
    setLoading(true);

    try {
      const { data } = await switchWorkspace({
        variables: { schoolId: membership.school.id },
      });

      if (data?.switchWorkspace?.accessToken) {
        await apolloClient.clearStore();
        tokenStorage.set(data.switchWorkspace.accessToken);
        tokenStorage.setSchoolId(membership.school.id);
        sessionStorage.removeItem('pending_memberships');

        router.push(ROLE_DASHBOARDS[membership.role] ?? '/');
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setSelected(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8"
      style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center
                          justify-center mx-auto mb-4"
               style={{ backgroundImage: 'linear-gradient(165deg, var(--bg-sidebar-grad-start) 0%, var(--bg-sidebar-grad-end) 100%)' }}>
            <Image src={logoImg} alt="Sulungukutu" width={28} height={28} />
          </div>
          <h1 className="text-3xl font-bold text-[var(--tx-primary)] mb-2">
            Choisissez un établissement
          </h1>
          <p className="text-[var(--tx-muted)]">
            Vous avez accès à plusieurs établissements. Sélectionnez celui
            dans lequel vous souhaitez travailler.
          </p>
        </div>

        {/* Liste workspaces */}
        <div className="space-y-3">
          {memberships.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelect(m)}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 rounded-xl
                         bg-[var(--bg-card)] border border-[var(--bd)] hover:border-indigo-300
                         hover:shadow-md transition-all duration-200 text-left
                         disabled:opacity-60 group"
            >
              {/* Avatar école */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br
                               ${ROLE_COLORS[m.role] ?? 'from-slate-500 to-slate-700'}
                               flex items-center justify-center flex-shrink-0`}>
                {m.school.logoUrl ? (
                  <img
                    src={m.school.logoUrl}
                    alt={m.school.nom}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-lg">
                    {m.school.nom.charAt(0)}
                  </span>
                )}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--tx-primary)] text-base">
                  {m.school.nom}
                </p>
                <p className="text-[var(--tx-muted)] text-sm">{ROLE_LABELS[m.role]}</p>
                <p className="text-[var(--tx-muted)] text-xs mt-0.5">
                  Code : {m.code}
                </p>
              </div>

              {/* Arrow ou spinner */}
              {selected === m.id && loading ? (
                <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600
                                rounded-full animate-spin flex-shrink-0" />
              ) : (
                <ChevronRight
                  size={20}
                  className="text-[var(--tx-muted)] group-hover:text-[var(--tx-secondary)]
                             transition-colors flex-shrink-0"
                />
              )}
            </button>
          ))}
        </div>

        <p className="text-center text-[var(--tx-muted)] text-xs mt-8">
          Vous pouvez changer d&apos;établissement à tout moment depuis le menu
          en haut de l&apos;interface.
        </p>
      </div>
    </div>
  );
}
