'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  INVITE_USER_MUTATION,
  SCHOOL_MEMBERS_QUERY,
  UPDATE_MEMBERSHIP_STATUS_MUTATION,
} from '@/lib/graphql/queries';
import { parseGqlError } from '@/lib/errorUtils';
import { tokenStorage } from '@/lib/apollo/client';
import { useToast } from '@/components/ui/Toast';
import { useActionToast } from '@/hooks/useActionToast';
import {
  Users, Plus, Mail, Phone, BookOpen,
  ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, Search, User,
} from 'lucide-react';
import { FormModal, FormField, FormSection, FormGrid, FormActions, CredentialsModal } from '@/components/ui/FormModal';

// ── Modal invitation ──────────────────────────────────────────
function InviteTeacherModal({
  schoolId, onClose, onInvited,
}: { schoolId: string; onClose: () => void; onInvited: () => void }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', phone: '' });
  const [inviteUser, { loading }] = useMutation(INVITE_USER_MUTATION);
  const [tempPassword, setTempPassword] = useState('');
  const [loginIdentifiant, setLoginIdentifiant] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleInvite = async () => {
    if (!form.nom || !form.prenom || !(form.email || form.phone)) return;
    try {
      const { data } = await inviteUser({
        variables: { input: { schoolId, role: 'TEACHER', ...form } },
      });
      setTempPassword(data?.inviteUser?.tempPassword ?? '');
      // Avant : la fenêtre affichait toujours `form.email`, qui est vide
      // si l'enseignant n'a été enregistré qu'avec un téléphone — on
      // affiche désormais l'identifiant réel (celui qui fonctionne pour
      // la connexion), avec repli sur l'email s'il existe.
      setLoginIdentifiant(form.email || data?.inviteUser?.membership?.profile?.code || '');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur invitation', message: parseGqlError(err) });
    }
  };

  if (tempPassword) return (
    <CredentialsModal
      title="Compte enseignant créé"
      subtitle={`${form.prenom} ${form.nom}`.trim()}
      identifiant={loginIdentifiant}
      password={tempPassword}
      recap={`${loginIdentifiant} / ${tempPassword}`}
      onClose={() => { onInvited(); onClose(); }}
    />
  );

  return (
    <FormModal
      title="Ajouter un enseignant"
      subtitle="Un mot de passe temporaire sera généré à la création."
      icon={<Users size={18} style={{ color: 'var(--accent)' }} />}
      onClose={onClose}
      onSubmit={handleInvite}
      maxWidth={520}
      footer={
        <FormActions
          hint="Email ou téléphone — au moins l'un des deux."
          submitLabel="Créer le compte"
          loading={loading}
          onCancel={onClose}
          disabled={!form.nom || !form.prenom || !(form.email || form.phone)}
        />
      }
    >
      <FormSection icon={<User size={14} style={{ color: 'var(--accent)' }} />} title="Identité">
        <FormGrid>
          <FormField label="Prénom" required>
            <input className="input" autoFocus value={form.prenom} onChange={(e) => set('prenom', e.target.value)} placeholder="Pierre" />
          </FormField>
          <FormField label="Nom" required>
            <input className="input" value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Makaya" />
          </FormField>
        </FormGrid>
        <FormGrid>
          <FormField label="Email">
            <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="prof@ecole.cg" />
          </FormField>
          <FormField label="Téléphone">
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="06 xxx xx xx" />
          </FormField>
        </FormGrid>
      </FormSection>
    </FormModal>
  );
}

// ── Carte enseignant ──────────────────────────────────────────
function TeacherCard({
  teacher, onToggleStatus,
}: { teacher: any; onToggleStatus: (id: string, current: string) => void }) {
  const p = teacher.profile;
  const isActive = teacher.status === 'ACTIVE';
  const subjects: string[] = [...new Set<string>(
    (teacher.classSubjects ?? []).map((cs: any) => cs.subject?.nom).filter((x: any): x is string => Boolean(x))
  )];
  const classes: string[] = [...new Set<string>(
    (teacher.classSubjects ?? []).map((cs: any) => cs.class?.nom).filter((x: any): x is string => Boolean(x))
  )];

  return (
    <div className={`card transition-all ${!isActive ? 'opacity-60 border-dashed' : ''}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-[var(--ok-bg)] flex items-center justify-center
                        text-[var(--ok)] font-bold text-lg flex-shrink-0">
          {p?.avatarUrl
            ? <img src={p.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
            : p?.prenom?.[0] ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[var(--tx-primary)]">{p?.prenom} {p?.nom}</p>
          <p className="text-xs font-mono text-[var(--tx-muted)]">{teacher.code}</p>
        </div>
        <button
          onClick={() => onToggleStatus(teacher.id, teacher.status)}
          title={isActive ? 'Désactiver' : 'Activer'}
          className={`p-1 rounded-lg transition-colors flex-shrink-0
            ${isActive ? 'text-[var(--ok)] hover:text-[var(--err)] hover:bg-[var(--err-bg)]'
                       : 'text-[var(--tx-muted)] hover:text-[var(--ok)] hover:bg-[var(--ok-bg)]'}`}
        >
          {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </div>

      <div className="space-y-1.5 text-sm mb-4">
        {p?.email && (
          <div className="flex items-center gap-2 text-[var(--tx-secondary)]">
            <Mail size={13} className="text-[var(--tx-muted)] flex-shrink-0" />
            <span className="truncate">{p.email}</span>
          </div>
        )}
        {p?.phone && (
          <div className="flex items-center gap-2 text-[var(--tx-secondary)]">
            <Phone size={13} className="text-[var(--tx-muted)] flex-shrink-0" />
            <span>{p.phone}</span>
          </div>
        )}
      </div>

      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {subjects.slice(0, 4).map((s) => (
            <span key={s} className="badge badge-info text-xs">{s}</span>
          ))}
          {subjects.length > 4 && (
            <span className="badge badge-neutral text-xs">+{subjects.length - 4}</span>
          )}
        </div>
      )}
      {classes.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--tx-muted)] mt-1">
          <BookOpen size={11} />
          <span>{classes.slice(0, 3).join(', ')}{classes.length > 3 ? ` +${classes.length - 3}` : ''}</span>
        </div>
      )}
      {subjects.length === 0 && (
        <p className="text-xs text-[var(--tx-muted)] italic">Aucune matière assignée</p>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function AdminTeachersPage() {
  const { addToast } = useToast();
  const schoolId      = tokenStorage.getSchoolId() ?? '';
  const [showModal, setModal] = useState(false);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');

  const { data, loading, refetch } = useQuery(SCHOOL_MEMBERS_QUERY, {
    variables: { schoolId, role: 'TEACHER', pagination: { page, limit: 20 } },
    skip: !schoolId,
  });

  const [updateStatus] = useMutation(UPDATE_MEMBERSHIP_STATUS_MUTATION);

  const teachers = data?.schoolMembers?.data ?? [];
  const pageInfo = data?.schoolMembers?.pageInfo;

  const filtered = search
    ? teachers.filter((t: any) => {
        const name = `${t.profile?.prenom} ${t.profile?.nom} ${t.profile?.email} ${t.code}`.toLowerCase();
        return name.includes(search.toLowerCase());
      })
    : teachers;

  const activeCount   = teachers.filter((t: any) => t.status === 'ACTIVE').length;
  const inactiveCount = teachers.length - activeCount;

  const handleToggleStatus = async (membershipId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action    = newStatus === 'ACTIVE' ? 'activer' : 'désactiver';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} cet enseignant ?`)) return;
    try {
      await updateStatus({ variables: { input: { membershipId, status: newStatus } } });
      refetch();
    } catch (err: any) { addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) }); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Enseignants</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">
            {pageInfo?.totalCount ?? 0} enseignant(s) ·{' '}
            <span className="text-[var(--ok)] font-medium">{activeCount} actifs</span>
            {inactiveCount > 0 && (
              <span className="text-[var(--tx-muted)]"> · {inactiveCount} inactifs</span>
            )}
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus size={15} /> Ajouter un enseignant
        </button>
      </div>

      {/* Recherche */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
          <input
            className="input pl-9 py-1.5 text-sm"
            placeholder="Rechercher par nom, email, code…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Grille */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <Users size={40} className="mb-3 opacity-40" />
          <p className="font-medium">
            {search ? 'Aucun résultat pour cette recherche' : 'Aucun enseignant enregistré'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t: any) => (
            <TeacherCard
              key={t.id}
              teacher={t}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pageInfo && pageInfo.totalPages > 1 && (
        <div className="flex items-center justify-between card p-3">
          <p className="text-sm text-[var(--tx-muted)]">
            Page {page} / {pageInfo.totalPages} · {pageInfo.totalCount} total
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pageInfo.hasPreviousPage}
              className="btn-secondary py-1 px-2 disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pageInfo.hasNextPage}
              className="btn-secondary py-1 px-2 disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <InviteTeacherModal
          schoolId={schoolId}
          onClose={() => setModal(false)}
          onInvited={() => {
            setPage(1);
            refetch({ schoolId, role: 'TEACHER', pagination: { page: 1, limit: 20 } });
          }}
        />
      )}
    </div>
  );
}
