'use client';
import { useToast } from '@/components/ui/Toast';
import { parseGqlError } from '@/lib/errorUtils';
import { tokenStorage } from '@/lib/apollo/client';

import { INVITE_USER_MUTATION, UPDATE_SCHOOL_MUTATION, SCHOOL_DETAIL_QUERY } from '@/lib/graphql/queries';

import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import {
  Building2, Users, GraduationCap, BookOpen,
  ChevronLeft, Mail, Phone, MapPin, Edit,
  UserPlus, Shield, User,
} from 'lucide-react';
import { FormModal, FormField, FormSection, FormGrid, FormActions, CredentialsModal } from '@/components/ui/FormModal';
import Link from 'next/link';
import { useState } from 'react';

export default function SchoolDetailPage() {
  const params   = useParams();
  const schoolId = params.id as string;
  const [editMode, setEditMode]   = useState(false);
  const [showInvite, setInvite]   = useState(false);
  const [inviteForm, setInvite2]  = useState({ nom: '', prenom: '', email: '', phone: '' });
  const [newAdminCreds, setNewAdminCreds] = useState<{ email: string; tempPassword: string } | null>(null);

  const { data, loading, refetch } = useQuery(SCHOOL_DETAIL_QUERY, {
    variables: { schoolId },
    skip:      !schoolId,
  });

  const [updateSchool] = useMutation(UPDATE_SCHOOL_MUTATION);
  const [inviteAdmin]  = useMutation(INVITE_USER_MUTATION);

  const school  = data?.schoolById;
  const dash    = data?.adminDashboard;
  const admins  = data?.schoolMembers?.data ?? [];

  const [form, setForm] = useState<any>({});
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const { addToast } = useToast();

  const handleSave = async () => {
    if (!form || Object.keys(form).length === 0) { setEditMode(false); return; }
    try {
      await updateSchool({ variables: { schoolId, input: form } });
      setEditMode(false); setForm({});
      refetch();
      addToast({ type: 'success', title: 'École mise à jour' });
    } catch(err: any) {
      addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
    }
  };

  const handleInvite = async () => {
    if (!(inviteForm.email || inviteForm.phone)) return;
    try {
      const { data: result } = await inviteAdmin({
        variables: {
          input: { schoolId, role: 'ADMIN', ...inviteForm },
        },
      });
      setInvite(false);
      setNewAdminCreds({
        // Avant : toujours inviteForm.email — vide si l'admin n'a été
        // enregistré qu'avec un téléphone. Repli sur l'identifiant réel
        // renvoyé par le serveur (celui qui fonctionne pour la connexion).
        email: inviteForm.email || result?.inviteUser?.membership?.profile?.code || '',
        tempPassword: result?.inviteUser?.tempPassword ?? '',
      });
      setInvite2({ nom: '', prenom: '', email: '', phone: '' });
      refetch();
      addToast({ type: 'success', title: 'Admin invité' });
    } catch(err: any) {
      addToast({ type: 'error', title: 'Erreur invitation', message: parseGqlError(err) });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  );
  if (!school) return <div className="text-center py-16 text-[var(--tx-muted)]">Établissement introuvable</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/superadmin/schools"
          className="flex items-center gap-1 text-sm text-[var(--tx-muted)] hover:text-[var(--tx-secondary)] transition-colors">
          <ChevronLeft size={16} /> Retour
        </Link>
      </div>

      {/* Header école */}
      <div className="card">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
            {school.logoUrl
              ? <img src={school.logoUrl} alt={school.nom} className="w-full h-full rounded-2xl object-cover" />
              : <Building2 size={28} className="text-[var(--tx-secondary)]" />}
          </div>
          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="space-y-3">
                <input className="input font-bold text-lg" defaultValue={school.nom}
                  onChange={(e) => set('nom', e.target.value)} />
                <input className="input text-sm" defaultValue={school.adresse ?? ''}
                  placeholder="Adresse" onChange={(e) => set('adresse', e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="input text-sm" defaultValue={school.phone ?? ''}
                    placeholder="Téléphone" onChange={(e) => set('phone', e.target.value)} />
                  <input className="input text-sm" defaultValue={school.email ?? ''}
                    placeholder="Email" onChange={(e) => set('email', e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="btn-primary py-1.5 text-sm">Enregistrer</button>
                  <button onClick={() => setEditMode(false)} className="btn-secondary py-1.5 text-sm">Annuler</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-[var(--tx-primary)]">{school.nom}</h1>
                  <span className="badge badge-neutral font-mono text-xs">{school.code}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-[var(--tx-muted)] flex-wrap">
                  {school.adresse && <span className="flex items-center gap-1"><MapPin size={13} />{school.adresse}</span>}
                  {school.phone   && <span className="flex items-center gap-1"><Phone size={13} />{school.phone}</span>}
                  {school.email   && <span className="flex items-center gap-1"><Mail size={13} />{school.email}</span>}
                </div>
                <p className="text-xs text-[var(--tx-muted)] mt-1">
                  Année scolaire : {school.anneeScolaire} ·
                  Créé le {new Date(school.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </>
            )}
          </div>
          {!editMode && (
            <button onClick={() => setEditMode(true)} className="btn-secondary py-1.5 text-sm flex-shrink-0">
              <Edit size={14} /> Modifier
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Élèves',       value: dash?.totalStudents,  icon: <GraduationCap size={18} />, color: 'text-[var(--tx-primary)] bg-[var(--info-bg)]' },
          { label: 'Enseignants',  value: dash?.totalTeachers,  icon: <Users size={18} />,         color: 'text-[var(--ok)] bg-[var(--ok-bg)]' },
          { label: 'Parents',      value: dash?.totalParents,   icon: <Users size={18} />,         color: 'text-[var(--warn)] bg-[var(--warn-bg)]' },
          { label: 'Classes',      value: dash?.totalClasses,   icon: <BookOpen size={18} />,      color: 'text-[var(--tx-secondary)] bg-[var(--bg-subtle)]' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center py-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-black text-[var(--tx-primary)]">{stat.value ?? 0}</p>
            <p className="text-xs text-[var(--tx-muted)] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Administrateurs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--tx-secondary)] flex items-center gap-2">
            <Shield size={16} className="text-violet-500" /> Administrateurs
          </h3>
          <button onClick={() => setInvite(true)} className="btn-secondary py-1.5 text-sm">
            <UserPlus size={14} /> Ajouter un admin
          </button>
        </div>

        {admins.length === 0 ? (
          <p className="text-[var(--tx-muted)] text-sm text-center py-4">Aucun administrateur configuré</p>
        ) : (
          <div className="space-y-2">
            {admins.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-[var(--bg-subtle)] rounded-xl">
                <div className="w-9 h-9 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center
                                text-[var(--tx-secondary)] font-bold flex-shrink-0">
                  {a.profile?.prenom?.[0] ?? '?'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--tx-primary)] text-sm">{a.profile?.prenom} {a.profile?.nom}</p>
                  <p className="text-xs text-[var(--tx-muted)]">{a.profile?.email}</p>
                </div>
                <span className={`badge ${a.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions rapides */}
      <div className="card">
        <h3 className="font-bold text-[var(--tx-secondary)] mb-3">Actions</h3>
        <div className="flex gap-3 flex-wrap">
          <Link
            href={`/admin/dashboard`}
            onClick={() => { tokenStorage.setSchoolId(schoolId); }}
            className="btn-secondary"
          >
            <Building2 size={15} /> Accéder en tant qu'admin
          </Link>
        </div>
      </div>

      {showInvite && (
        <FormModal
          title="Ajouter un administrateur"
          subtitle="Un mot de passe temporaire sera généré à la création."
          icon={<Shield size={18} style={{ color: 'var(--accent)' }} />}
          onClose={() => setInvite(false)}
          onSubmit={handleInvite}
          maxWidth={520}
          footer={
            <FormActions
              hint="Email ou téléphone — au moins l'un des deux."
              submitLabel="Créer le compte"
              onCancel={() => setInvite(false)}
              disabled={!(inviteForm.email || inviteForm.phone) || !inviteForm.nom || !inviteForm.prenom}
            />
          }
        >
          <FormSection icon={<User size={14} style={{ color: 'var(--accent)' }} />} title="Identité">
            <FormGrid>
              <FormField label="Prénom" required>
                <input className="input" autoFocus value={inviteForm.prenom}
                  onChange={(e) => setInvite2((f) => ({ ...f, prenom: e.target.value }))} />
              </FormField>
              <FormField label="Nom" required>
                <input className="input" value={inviteForm.nom}
                  onChange={(e) => setInvite2((f) => ({ ...f, nom: e.target.value }))} />
              </FormField>
            </FormGrid>
            <FormGrid>
              <FormField label="Email">
                <input className="input" type="email" value={inviteForm.email}
                  onChange={(e) => setInvite2((f) => ({ ...f, email: e.target.value }))} placeholder="admin@ecole.cg" />
              </FormField>
              <FormField label="Téléphone">
                <input className="input" type="tel" value={inviteForm.phone}
                  onChange={(e) => setInvite2((f) => ({ ...f, phone: e.target.value }))} placeholder="06 xxx xx xx" />
              </FormField>
            </FormGrid>
          </FormSection>
        </FormModal>
      )}

      {newAdminCreds && (
        <CredentialsModal
          title="Administrateur créé"
          identifiant={newAdminCreds.email}
          identifiantLabel="Identifiant de connexion"
          password={newAdminCreds.tempPassword}
          recap={`${newAdminCreds.email} / ${newAdminCreds.tempPassword}`}
          onClose={() => setNewAdminCreds(null)}
        />
      )}
    </div>
  );
}
