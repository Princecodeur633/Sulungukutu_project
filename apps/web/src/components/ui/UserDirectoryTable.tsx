'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { USERS_DIRECTORY_QUERY, ADMIN_RESET_PASSWORD_MUTATION } from '@/lib/graphql/queries';
import { chartColors } from '@/lib/chartColors';
import { Search, KeyRound, Copy, Phone, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Administrateur', TEACHER: 'Enseignant',
  PARENT: 'Parent', STUDENT: 'Élève',
};
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: chartColors.rose, ADMIN: chartColors.accent, TEACHER: chartColors.sky,
  PARENT: chartColors.amber, STUDENT: chartColors.emerald,
};
const ROLE_ORDER = ['ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'SUPER_ADMIN'];

interface Props {
  /** Omis = toute la plateforme (Super Admin uniquement). */
  schoolId?: string;
}

export function UserDirectoryTable({ schoolId }: Props) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [resetTarget, setResetTarget] = useState<any | null>(null);
  const [resetResult, setResetResult] = useState<{ tempPassword: string; hasRealEmail: boolean } | null>(null);
  const toast = useToast();

  const { data, loading, refetch } = useQuery(USERS_DIRECTORY_QUERY, {
    variables: { schoolId },
  });
  const [adminResetPassword, { loading: resetting }] = useMutation(ADMIN_RESET_PASSWORD_MUTATION);

  const entries: any[] = data?.usersDirectory ?? [];

  const availableRoles = useMemo(
    () => ROLE_ORDER.filter((r) => entries.some((e) => e.role === r)),
    [entries]
  );

  const filtered = entries.filter((e) => {
    if (roleFilter !== 'ALL' && e.role !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      e.nom.toLowerCase().includes(q) ||
      e.prenom.toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q) ||
      (e.matricule ?? '').toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.phone ?? '').includes(q)
    );
  });

  const handleReset = async () => {
    if (!resetTarget) return;
    try {
      const { data: res } = await adminResetPassword({ variables: { membershipId: resetTarget.membershipId } });
      setResetResult(res?.adminResetPassword ?? null);
    } catch (err: any) {
      toast.error('Échec de la réinitialisation', err?.message);
      setResetTarget(null);
    }
  };

  return (
    <div>
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)' }} />
          <input
            className="input" style={{ paddingLeft: 36 }}
            placeholder="Nom, identifiant, matricule, téléphone, email..."
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input sm:w-48" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="ALL">Tous les rôles</option>
          {availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
        </select>
      </div>

      {loading && <p className="text-sm text-[var(--tx-muted)]">Chargement…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-[var(--tx-muted)] py-8 text-center">Aucun utilisateur trouvé.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                <th className="table-cell text-left" style={{ fontWeight: 600, color: 'var(--tx-muted)', fontSize: 11.5, textTransform: 'uppercase' }}>Utilisateur</th>
                <th className="table-cell text-left" style={{ fontWeight: 600, color: 'var(--tx-muted)', fontSize: 11.5, textTransform: 'uppercase' }}>Rôle</th>
                <th className="table-cell text-left" style={{ fontWeight: 600, color: 'var(--tx-muted)', fontSize: 11.5, textTransform: 'uppercase' }}>Identifiant</th>
                <th className="table-cell text-left" style={{ fontWeight: 600, color: 'var(--tx-muted)', fontSize: 11.5, textTransform: 'uppercase' }}>Contact</th>
                {!schoolId && <th className="table-cell text-left" style={{ fontWeight: 600, color: 'var(--tx-muted)', fontSize: 11.5, textTransform: 'uppercase' }}>École</th>}
                <th className="table-cell text-left" style={{ fontWeight: 600, color: 'var(--tx-muted)', fontSize: 11.5, textTransform: 'uppercase' }}>Statut</th>
                <th className="table-cell text-right" style={{ fontWeight: 600, color: 'var(--tx-muted)', fontSize: 11.5, textTransform: 'uppercase' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.membershipId} style={{ borderBottom: '1px solid var(--bd)' }}>
                  <td className="table-cell">
                    <p style={{ fontWeight: 600, color: 'var(--tx-primary)' }}>{e.prenom} {e.nom}</p>
                    {e.matricule && <p style={{ fontSize: 11, color: 'var(--tx-muted)' }}>Matricule {e.matricule}</p>}
                  </td>
                  <td className="table-cell">
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                      background: `${ROLE_COLORS[e.role] ?? chartColors.accent}1a`,
                      color: ROLE_COLORS[e.role] ?? chartColors.accent,
                    }}>
                      {ROLE_LABELS[e.role] ?? e.role}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono" style={{ fontSize: 12.5, color: 'var(--tx-secondary)' }}>{e.code}</span>
                  </td>
                  <td className="table-cell">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--tx-secondary)' }}>
                        <Mail size={11} style={{ color: 'var(--tx-muted)' }} /> {e.email}
                      </span>
                      {e.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--tx-secondary)' }}>
                          <Phone size={11} style={{ color: 'var(--tx-muted)' }} /> {e.phone}
                        </span>
                      )}
                    </div>
                  </td>
                  {!schoolId && <td className="table-cell" style={{ fontSize: 12.5, color: 'var(--tx-secondary)' }}>{e.schoolName}</td>}
                  <td className="table-cell">
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                      background: e.status === 'ACTIVE' ? 'var(--ok-bg)' : 'var(--bg-subtle)',
                      color: e.status === 'ACTIVE' ? 'var(--ok)' : 'var(--tx-muted)',
                    }}>
                      {e.status === 'ACTIVE' ? 'Actif' : e.status === 'SUSPENDED' ? 'Suspendu' : 'Inactif'}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <button
                      onClick={() => { setResetTarget(e); setResetResult(null); }}
                      title="Réinitialiser le mot de passe (si la personne a perdu ses identifiants)"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: 'none', border: '1px solid var(--bd)', borderRadius: 7,
                        padding: '5px 9px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                        color: 'var(--tx-secondary)',
                      }}
                    >
                      <KeyRound size={12} /> Réinitialiser
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale de réinitialisation */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setResetTarget(null); setResetResult(null); }} />
          <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--warn-bg)] flex items-center justify-center mx-auto mb-4">
              <KeyRound size={24} style={{ color: 'var(--warn)' }} />
            </div>
            <h2 className="text-lg font-bold text-[var(--tx-primary)] mb-1">
              {resetTarget.prenom} {resetTarget.nom}
            </h2>
            <p className="text-sm text-[var(--tx-muted)] mb-5">{resetTarget.code}</p>

            {!resetResult ? (
              <>
                <p className="text-sm text-[var(--tx-secondary)] mb-5">
                  Génère un nouveau mot de passe temporaire à communiquer immédiatement
                  à la personne (par téléphone, par exemple). L'ancien cessera de fonctionner.
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
                  <p className="font-mono text-sm font-bold text-[var(--tx-primary)] mb-3">{resetTarget.code}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tx-muted)] mb-1">Nouveau mot de passe</p>
                  <p className="font-mono text-xl font-bold tracking-widest text-[var(--tx-primary)] select-all">
                    {resetResult.tempPassword}
                  </p>
                </div>
                {!resetResult.hasRealEmail && (
                  <p style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 14 }}>
                    Cette personne n'a pas d'email personnel — communiquez ce mot de passe directement, aucun email n'a été envoyé.
                  </p>
                )}
                <button
                  onClick={() => navigator.clipboard?.writeText(`${resetTarget.code} / ${resetResult.tempPassword}`)}
                  className="btn-secondary w-full justify-center mb-2 text-sm"
                >
                  <Copy size={13} className="mr-1" /> Copier l'identifiant et le mot de passe
                </button>
                <button
                  className="btn-primary w-full justify-center"
                  onClick={() => { setResetTarget(null); setResetResult(null); refetch(); }}
                >
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
