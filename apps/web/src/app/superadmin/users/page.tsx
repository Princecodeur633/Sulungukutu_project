'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { ALL_PROFILES_QUERY, UPDATE_MEMBERSHIP_STATUS_MUTATION, ADMIN_RESET_PASSWORD_MUTATION } from '@/lib/graphql/queries';
import { useActionToast } from '@/hooks/useActionToast';
import { useToast } from '@/components/ui/Toast';
import {
  Users, Search, ChevronLeft, ChevronRight, Shield,
  Building2, Mail, Phone, ToggleLeft, ToggleRight,
  Eye, X, Calendar, GraduationCap, BookOpen, UserCircle, Filter, KeyRound, Copy,
} from 'lucide-react';

/* ── Constantes ────────────────────────────────────────────── */
const ROLES = ['TOUS', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'SUPER_ADMIN'] as const;
type RoleFilter = typeof ROLES[number];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', TEACHER: 'Enseignant', PARENT: 'Parent',
  STUDENT: 'Élève', SUPER_ADMIN: 'Super Admin', TOUS: 'Tous',
};
const ROLE_COLORS: Record<string, string> = {
  ADMIN:       'badge-info',
  TEACHER:     'badge-success',
  PARENT:      'bg-[var(--warn-bg)] text-[var(--warn)]',
  STUDENT:     'bg-[var(--bg-subtle)] text-[var(--tx-secondary)]',
  SUPER_ADMIN: 'bg-[var(--err-bg)] text-[var(--err)]',
};
const ROLE_ICONS: Record<string, React.ReactNode> = {
  ADMIN:       <Building2 size={13} />,
  TEACHER:     <BookOpen size={13} />,
  PARENT:      <UserCircle size={13} />,
  STUDENT:     <GraduationCap size={13} />,
  SUPER_ADMIN: <Shield size={13} />,
};

/* ── Modal détail ───────────────────────────────────────────── */
function UserDetailModal({ profile, onClose, onToggle }: {
  profile: any; onClose: () => void;
  onToggle: (membershipId: string, currentStatus: string) => void;
}) {
  const [resetTarget, setResetTarget] = useState<any | null>(null);
  const [resetResult, setResetResult] = useState<{ tempPassword: string; hasRealEmail: boolean } | null>(null);
  const [adminResetPassword, { loading: resetting }] = useMutation(ADMIN_RESET_PASSWORD_MUTATION);
  const toast = useToast();

  const handleReset = async () => {
    if (!resetTarget) return;
    try {
      const { data } = await adminResetPassword({ variables: { membershipId: resetTarget.id } });
      setResetResult(data?.adminResetPassword ?? null);
    } catch (err: any) {
      toast.error('Échec de la réinitialisation', err?.message);
      setResetTarget(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--bd)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center
                            text-[var(--tx-secondary)] font-bold text-lg flex-shrink-0">
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                : (profile.prenom?.[0] ?? '?')}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--tx-primary)]">
                {profile.prenom} {profile.nom}
                {profile.isSuperAdmin && <Shield size={14} className="inline ml-1.5 text-[var(--err)]" />}
              </h2>
              <p className="text-sm text-[var(--tx-muted)] font-mono">{profile.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--tx-muted)] hover:text-[var(--tx-secondary)] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Infos */}
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {profile.email && (
              <div className="flex items-center gap-2 text-sm text-[var(--tx-secondary)]">
                <Mail size={14} className="text-[var(--tx-muted)] flex-shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
            )}
            {profile.phone && (
              <div className="flex items-center gap-2 text-sm text-[var(--tx-secondary)]">
                <Phone size={14} className="text-[var(--tx-muted)] flex-shrink-0" />
                <span>{profile.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-[var(--tx-muted)]">
              <Calendar size={14} className="flex-shrink-0" />
              <span>Inscrit le {new Date(profile.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}</span>
            </div>
          </div>

          {/* Memberships groupés par établissement */}
          {profile.memberships?.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-[var(--tx-secondary)] mb-2 flex items-center gap-2">
                <Building2 size={14} className="text-[var(--tx-muted)]" />
                Établissements ({profile.memberships.length})
              </h3>
              <div className="space-y-2">
                {profile.memberships.map((m: any) => {
                  const isActive = m.status === 'ACTIVE';
                  return (
                    <div key={m.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--bd)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Building2 size={14} className="text-[var(--tx-muted)] flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--tx-secondary)] truncate">
                            {m.school?.nom ?? 'École inconnue'}
                          </p>
                          {m.studentProfile?.matricule && (
                            <p className="text-xs text-[var(--tx-muted)] font-mono">Matricule {m.studentProfile.matricule}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`badge text-xs ${ROLE_COLORS[m.role] ?? 'badge-neutral'}`}>
                              {ROLE_ICONS[m.role]}
                              <span className="ml-1">{ROLE_LABELS[m.role] ?? m.role}</span>
                            </span>
                            <span className={`badge text-xs ${isActive ? 'badge-success' : 'badge-neutral'}`}>
                              {isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!profile.isSuperAdmin && (
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <button
                            onClick={() => { setResetTarget(m); setResetResult(null); }}
                            title="Réinitialiser le mot de passe"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                                       border border-[var(--bd)] text-[var(--tx-secondary)] hover:bg-[var(--bg-subtle)] transition-all"
                          >
                            <KeyRound size={13} />
                          </button>
                          <button
                            onClick={() => onToggle(m.id, m.status)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                        transition-all border
                                        ${isActive
                                          ? 'border-red-200 text-[var(--err)] hover:bg-[var(--err-bg)]'
                                          : 'border-[var(--bd)] text-[var(--ok)] hover:bg-[var(--ok-bg)]'}`}
                          >
                            {isActive ? <><ToggleLeft size={14} /> Désactiver</> : <><ToggleRight size={14} /> Réactiver</>}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setResetTarget(null); setResetResult(null); }} />
          <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--warn-bg)] flex items-center justify-center mx-auto mb-4">
              <KeyRound size={24} style={{ color: 'var(--warn)' }} />
            </div>
            <h2 className="text-lg font-bold text-[var(--tx-primary)] mb-1">{profile.prenom} {profile.nom}</h2>
            <p className="text-sm text-[var(--tx-muted)] mb-5">{profile.code} · {resetTarget.school?.nom}</p>

            {!resetResult ? (
              <>
                <p className="text-sm text-[var(--tx-secondary)] mb-5">
                  Génère un nouveau mot de passe temporaire à communiquer immédiatement à la personne. L'ancien cessera de fonctionner.
                </p>
                <div className="flex gap-2 justify-center">
                  <button className="btn-secondary text-sm" onClick={() => setResetTarget(null)}>Annuler</button>
                  <button className="btn-primary text-sm" onClick={handleReset} disabled={resetting}>
                    {resetting ? 'Génération…' : 'Générer un nouveau mot de passe'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-[var(--bg-subtle)] rounded-xl p-4 mb-3 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tx-muted)] mb-1">Identifiant</p>
                  <p className="font-mono text-sm font-bold text-[var(--tx-primary)] mb-3">{profile.code}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tx-muted)] mb-1">Nouveau mot de passe</p>
                  <p className="font-mono text-xl font-bold tracking-widest text-[var(--tx-primary)] select-all">
                    {resetResult.tempPassword}
                  </p>
                </div>
                {!resetResult.hasRealEmail && (
                  <p style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 14 }}>
                    Cette personne n'a pas d'email personnel — communiquez ce mot de passe directement.
                  </p>
                )}
                <button
                  onClick={() => navigator.clipboard?.writeText(`${profile.code} / ${resetResult.tempPassword}`)}
                  className="btn-secondary w-full justify-center mb-2 text-sm"
                >
                  <Copy size={13} className="mr-1" /> Copier l'identifiant et le mot de passe
                </button>
                <button className="btn-primary w-full justify-center" onClick={() => { setResetTarget(null); setResetResult(null); }}>
                  Fermer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function UserCard({ profile, onSelect }: { profile: any; onSelect: () => void }) {
  const initials = [profile.prenom?.[0], profile.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  const roles = [...new Set((profile.memberships ?? []).map((m: any) => m.role))] as string[];
  const hasInactive = (profile.memberships ?? []).some((m: any) => m.status !== 'ACTIVE');

  return (
    <div className="card-hover flex items-center gap-3 p-3 cursor-pointer" onClick={onSelect}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center
                      text-[var(--tx-secondary)] font-bold text-sm flex-shrink-0 border border-[var(--bd)]">
        {profile.avatarUrl
          ? <img src={profile.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
          : initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-[var(--tx-primary)] truncate">
            {profile.prenom} {profile.nom}
          </p>
          {profile.isSuperAdmin && <Shield size={11} className="text-[var(--err)] flex-shrink-0" />}
          {roles.map((role: string) => (
            <span key={role} className={`badge text-xs ${ROLE_COLORS[role] ?? 'badge-neutral'}`}>
              {ROLE_LABELS[role] ?? role}
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--tx-muted)] truncate mt-0.5">{profile.email}</p>
        {/* Établissements */}
        {(profile.memberships ?? []).length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {(profile.memberships ?? []).slice(0, 2).map((m: any) => (
              <span key={m.id} className="flex items-center gap-1 text-xs text-[var(--tx-muted)]
                                          bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded-md border border-[var(--bd)]">
                <Building2 size={9} className="flex-shrink-0" />
                <span className="truncate max-w-[90px]">{m.school?.nom}</span>
                {m.status !== 'ACTIVE' && <span className="text-[var(--warn)]">·inactif</span>}
              </span>
            ))}
            {(profile.memberships ?? []).length > 2 && (
              <span className="text-xs text-[var(--tx-muted)]">+{profile.memberships.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* Statut & action */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {hasInactive && (
          <span className="text-xs text-[var(--warn)]">
            <ToggleLeft size={12} className="inline" /> Partiel
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="p-1.5 rounded-lg text-[var(--tx-muted)] hover:text-[var(--tx-primary)]
                     hover:bg-[var(--info-bg)] transition-all"
        >
          <Eye size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Page principale ────────────────────────────────────────── */
export default function SuperAdminUsersPage() {
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('TOUS');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [selected, setSelected]   = useState<any>(null);
  const run = useActionToast();

  const { data, loading, refetch } = useQuery(ALL_PROFILES_QUERY, {
    variables: { pagination: { page, limit: 50 } },
  });
  const [updateStatus] = useMutation(UPDATE_MEMBERSHIP_STATUS_MUTATION);

  const profiles  = data?.allProfiles?.data ?? [];
  const pageInfo  = data?.allProfiles?.pageInfo;

  // Extraire tous les établissements uniques
  const allSchools = Array.from(
    new Map(
      profiles.flatMap((p: any) => (p.memberships ?? []).map((m: any) => m.school))
        .filter(Boolean)
        .map((s: any) => [s.id, s])
    ).values()
  ) as any[];

  // Filtres
  const filtered = profiles.filter((p: any) => {
    // Filtre texte
    if (search) {
      const hay = `${p.prenom} ${p.nom} ${p.email ?? ''} ${p.code ?? ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    // Filtre rôle
    if (roleFilter !== 'TOUS') {
      if (roleFilter === 'SUPER_ADMIN') {
        if (!p.isSuperAdmin) return false;
      } else {
        const hasRole = (p.memberships ?? []).some((m: any) => m.role === roleFilter);
        if (!hasRole) return false;
      }
    }
    // Filtre établissement
    if (schoolFilter) {
      const hasSchool = (p.memberships ?? []).some((m: any) => m.school?.id === schoolFilter);
      if (!hasSchool) return false;
    }
    return true;
  });

  // Grouper par rôle dominant pour l'affichage en sections
  const grouped: Record<string, any[]> = {};
  const roleOrder = ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT'];

  for (const p of filtered) {
    if (p.isSuperAdmin) {
      (grouped['SUPER_ADMIN'] = grouped['SUPER_ADMIN'] ?? []).push(p);
      continue;
    }
    const roles = [...new Set((p.memberships ?? []).map((m: any) => m.role))] as string[];
    if (roles.length === 0) {
      (grouped['SANS_ROLE'] = grouped['SANS_ROLE'] ?? []).push(p);
    } else {
      // Mettre dans le groupe du rôle le plus "élevé"
      const dominant = roleOrder.find(r => roles.includes(r)) ?? roles[0];
      (grouped[dominant] = grouped[dominant] ?? []).push(p);
    }
  }

  const handleToggle = async (membershipId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const label = newStatus === 'ACTIVE' ? 'réactivé' : 'désactivé';
    await run(
      () => updateStatus({ variables: { input: { membershipId, status: newStatus } } }),
      { success: `Accès ${label}`, errorPrefix: "Impossible de modifier l'accès" }
    );
    refetch();
    if (selected) {
      setSelected((prev: any) => ({
        ...prev,
        memberships: prev.memberships.map((m: any) =>
          m.id === membershipId ? { ...m, status: newStatus } : m
        ),
      }));
    }
  };

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="page-subtitle">
            {pageInfo?.totalCount ?? 0} profil(s) · {filtered.length} affiché(s)
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card space-y-3">
        {/* Barre de recherche */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
            <input
              className="input pl-9 py-2 text-sm w-full"
              placeholder="Nom, email, code…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          {/* Filtre établissement */}
          {allSchools.length > 0 && (
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
              <select
                className="input pl-9 py-2 text-sm pr-8"
                value={schoolFilter}
                onChange={(e) => { setSchoolFilter(e.target.value); setPage(1); }}
              >
                <option value="">Tous les établissements</option>
                {allSchools.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filtres par rôle — pills */}
        <div className="flex gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--tx-muted)]">
            <Filter size={12} /> Rôle :
          </span>
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => { setRoleFilter(r); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                roleFilter === r
                  ? 'bg-[var(--tx-primary)] text-[var(--tx-inverse)] border-[var(--tx-primary)]'
                  : 'bg-[var(--bg-card)] text-[var(--tx-secondary)] border-[var(--bd)] hover:border-[var(--tx-primary)]'
              }`}
            >
              {ROLE_LABELS[r]}
              {r !== 'TOUS' && (
                <span className="ml-1 opacity-60">
                  ({r === 'SUPER_ADMIN'
                    ? profiles.filter((p: any) => p.isSuperAdmin).length
                    : profiles.filter((p: any) => (p.memberships ?? []).some((m: any) => m.role === r)).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <Users size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Aucun utilisateur trouvé</p>
          {(search || roleFilter !== 'TOUS' || schoolFilter) && (
            <button
              onClick={() => { setSearch(''); setRoleFilter('TOUS'); setSchoolFilter(''); }}
              className="btn-secondary mt-3 text-sm"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      ) : roleFilter !== 'TOUS' ? (
        // Vue plate quand un rôle est sélectionné
        <div className="card p-0 overflow-hidden divide-y divide-[var(--bd)]">
          {filtered.map((p: any) => (
            <UserCard key={p.id} profile={p} onSelect={() => setSelected(p)} />
          ))}
        </div>
      ) : (
        // Vue groupée par rôle
        <div className="space-y-4">
          {roleOrder
            .filter(role => grouped[role]?.length > 0)
            .map(role => (
              <div key={role} className="card p-0 overflow-hidden">
                {/* Header de section */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--bd)]">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    role === 'SUPER_ADMIN' ? 'bg-[var(--err-bg)] text-[var(--err)]' :
                    role === 'ADMIN'       ? 'bg-[var(--info-bg)] text-[var(--info)]' :
                    role === 'TEACHER'     ? 'bg-[var(--ok-bg)] text-[var(--ok)]' :
                    role === 'PARENT'      ? 'bg-[var(--warn-bg)] text-[var(--warn)]' :
                                            'bg-[var(--bg-subtle)] text-[var(--tx-secondary)]'
                  }`}>
                    {ROLE_ICONS[role] ?? <Users size={13} />}
                  </span>
                  <h3 className="font-bold text-sm text-[var(--tx-primary)]">
                    {ROLE_LABELS[role] ?? role}
                  </h3>
                  <span className="badge badge-neutral text-xs ml-auto">
                    {grouped[role].length}
                  </span>
                </div>

                {/* Liste */}
                <div className="divide-y divide-[var(--bd)]">
                  {grouped[role].map((p: any) => (
                    <UserCard key={p.id} profile={p} onSelect={() => setSelected(p)} />
                  ))}
                </div>
              </div>
            ))
          }
          {/* Sans rôle */}
          {grouped['SANS_ROLE']?.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-subtle)] border-b border-[var(--bd)]">
                <span className="w-7 h-7 rounded-lg bg-[var(--bg-subtle)] text-[var(--tx-muted)] flex items-center justify-center border border-[var(--bd)]">
                  <Users size={13} />
                </span>
                <h3 className="font-bold text-sm text-[var(--tx-muted)]">Sans rôle assigné</h3>
                <span className="badge badge-neutral text-xs ml-auto">{grouped['SANS_ROLE'].length}</span>
              </div>
              <div className="divide-y divide-[var(--bd)]">
                {grouped['SANS_ROLE'].map((p: any) => (
                  <UserCard key={p.id} profile={p} onSelect={() => setSelected(p)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {pageInfo && pageInfo.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--tx-muted)]">
            Page {page} / {pageInfo.totalPages} · {pageInfo.totalCount} total
          </p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => p - 1)} disabled={!pageInfo.hasPreviousPage}
              className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={!pageInfo.hasNextPage}
              className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Modal détail */}
      {selected && (
        <UserDetailModal
          profile={selected}
          onClose={() => setSelected(null)}
          onToggle={handleToggle}
        />
      )}
    </div>
  );
}
