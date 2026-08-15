'use client';
import React from 'react';
import { parseGqlError } from '@/lib/errorUtils';

import { ALL_SCHOOLS_QUERY, CREATE_SCHOOL_MUTATION } from '@/lib/graphql/queries';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Building2, Plus, ChevronRight, Search,
  Phone, MapPin, ChevronLeft
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';

// Devine l'année scolaire en cours à partir de la date du jour (au lieu de la
// coder en dur : une école créée après juillet 2025 se retrouvait avec
// "2024-2025" pré-rempli par défaut, une année déjà révolue).
function guessCurrentAnneeScolaire(): string {
  const now = new Date();
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

function CreateSchoolModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    nom: '', adresse: '', telephone: '', anneeScolaire: guessCurrentAnneeScolaire(),
    adminEmail: '', adminPhone: '', adminNom: '', adminPrenom: '',
  });
  const [createSchool, { loading }] = useMutation(CREATE_SCHOOL_MUTATION);
  const [done, setDone]             = useState<any>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.nom || !(form.adminEmail || form.adminPhone)) return;
    try {
      const { data } = await createSchool({
        variables: {
          input: {
            nom:           form.nom,
            adresse:       form.adresse,
            telephone:     form.telephone,
            anneeScolaire: form.anneeScolaire,
            adminEmail:    form.adminEmail || undefined,
            adminPhone:    form.adminPhone || undefined,
            adminNom:      form.adminNom,
            adminPrenom:   form.adminPrenom,
          },
        },
      });
      setDone(data?.createSchool);
      onCreated();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
    }
  };

  const [copied, setCopied] = React.useState(false);
  const copyPwd = () => {
    navigator.clipboard?.writeText(done?.adminTempPassword ?? '');
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  if (done) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', background: 'rgba(15,14,23,.65)' }}>
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto" style={{ border: '1px solid var(--bd)' }}>
        {/* Header */}
        <div className="p-6 text-center border-b border-[var(--bd)]">
          <div className="w-16 h-16 rounded-2xl bg-[var(--ok-bg)] border border-[var(--bd)] flex items-center justify-center mx-auto mb-4">
            <Building2 size={26} style={{ color: 'var(--ok)' }} />
          </div>
          <h2 className="text-xl font-bold text-[var(--tx-primary)]" style={{ fontFamily: "Sora, sans-serif" }}>Établissement créé !</h2>
          <p className="text-sm text-[var(--tx-muted)] mt-1">{done.school?.nom ?? done.nom}</p>
        </div>

        {/* Identifiants */}
        <div className="p-6 space-y-4">
          <div style={{ background: 'var(--warn-bg)', border: '1.5px solid var(--warn)', borderRadius: 12, padding: '14px 16px' }}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 16 }}>🔑</span>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--warn)', fontFamily: 'Sora, sans-serif' }}>
                Identifiants de connexion
              </p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginBottom: 12, lineHeight: 1.6 }}>
              Transmettez ces informations à l&apos;administrateur. Ce mot de passe <strong>ne sera plus visible</strong> après fermeture.
            </p>
            <div className="space-y-2">
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 11, color: 'var(--tx-muted)', marginBottom: 3, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Identifiant</p>
                <p style={{ fontSize: 13.5, fontFamily: 'monospace', fontWeight: 600, color: 'var(--tx-primary)' }}>{done.adminIdentifiant}</p>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-muted)', marginBottom: 3, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Mot de passe temporaire</p>
                  <p style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--tx-primary)', userSelect: 'all' }}>{done.adminTempPassword}</p>
                </div>
                <button onClick={copyPwd} className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12, flexShrink: 0 }}>
                  {copied ? '✓ Copié' : 'Copier'}
                </button>
              </div>
              {!done.hasRealEmail && (
                <p style={{ fontSize: 12, color: 'var(--warn)' }}>
                  Aucun email personnel fourni — aucun email n'a été envoyé, communiquez ces identifiants directement.
                </p>
              )}
            </div>
          </div>

          <button onClick={onClose} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
            J&apos;ai noté — Fermer
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-[var(--bd)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--tx-primary)]">Créer un établissement</h2>
          <button onClick={onClose} className="text-[var(--tx-muted)] hover:text-[var(--tx-secondary)] text-xl">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Infos école */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--tx-secondary)] mb-3 uppercase tracking-wide">
              Établissement
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label">Nom *</label>
                <input className="input" value={form.nom} onChange={(e) => set('nom', e.target.value)}
                  placeholder="ex: Lycée Victor Hugo, École Saint-Joseph..." />
              </div>
              <div>
                <label className="label">Adresse</label>
                <input className="input" value={form.adresse} onChange={(e) => set('adresse', e.target.value)}
                  placeholder="Rue, ville..." />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} placeholder="+242 06 xxx xxx" />
              </div>
              <div>
                <label className="label">Année scolaire</label>
                <input className="input" value={form.anneeScolaire} onChange={(e) => set('anneeScolaire', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Admin de l'école */}
          <div className="border-t border-[var(--bd)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--tx-secondary)] mb-3 uppercase tracking-wide">
              Compte Administrateur
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prénom admin</label>
                  <input className="input" value={form.adminPrenom} onChange={(e) => set('adminPrenom', e.target.value)} />
                </div>
                <div>
                  <label className="label">Nom admin</label>
                  <input className="input" value={form.adminNom} onChange={(e) => set('adminNom', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Email admin</label>
                <input className="input" type="email" value={form.adminEmail}
                  onChange={(e) => set('adminEmail', e.target.value)}
                  placeholder="admin@ecole.edu" />
              </div>
              <div>
                <label className="label">Téléphone admin</label>
                <input className="input" type="tel" value={form.adminPhone}
                  onChange={(e) => set('adminPhone', e.target.value)}
                  placeholder="06 XXX XX XX" />
                <p style={{ fontSize: 11.5, color: 'var(--tx-muted)', marginTop: 4 }}>
                  Email ou téléphone requis (au moins l'un des deux).
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--bd)] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button
            onClick={handleCreate}
            disabled={loading || !form.nom || !(form.adminEmail || form.adminPhone)}
            className="btn-primary"
          >
            {loading ? 'Création…' : 'Créer l\'établissement'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminSchoolsPage() {
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [showModal, setModal]     = useState(false);

  const { data, loading, refetch } = useQuery(ALL_SCHOOLS_QUERY, {
    variables: { pagination: { page, limit: 15 } },
  });

  const schools  = data?.allSchools?.data ?? [];
  const pageInfo = data?.allSchools?.pageInfo;

  const filtered = search
    ? schools.filter((s: any) =>
        s.nom.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())
      )
    : schools;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Établissements</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">
            {pageInfo?.totalCount ?? 0} établissement(s) sur la plateforme
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus size={15} /> Créer un établissement
        </button>
      </div>

      {/* Recherche */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
          <input
            className="input pl-9 py-1.5 text-sm"
            placeholder="Rechercher par nom ou code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <Building2 size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Aucun établissement trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((school: any) => (
            <Link
              key={school.id}
              href={`/superadmin/schools/${school.id}`}
              className="card flex items-center gap-5 hover:border-violet-200 hover:shadow-md
                         transition-all group cursor-pointer block"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
                {school.logoUrl
                  ? <img src={school.logoUrl} alt={school.nom} className="w-full h-full rounded-xl object-cover" />
                  : <Building2 size={22} className="text-[var(--tx-secondary)]" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-[var(--tx-primary)]">{school.nom}</h3>
                  <span className="badge badge-neutral font-mono text-xs">{school.code}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--tx-muted)] flex-wrap">
                  {school.adresse && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {school.adresse}
                    </span>
                  )}
                  {school.telephone && (
                    <span className="flex items-center gap-1">
                      <Phone size={11} /> {school.telephone}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-xs text-[var(--tx-muted)]">{school.anneeScolaire}</p>
                <p className="text-xs text-[var(--tx-muted)] mt-0.5">
                  Créé {new Date(school.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>

              <ChevronRight size={16} className="text-[var(--tx-muted)] group-hover:text-violet-500 transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pageInfo && pageInfo.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--tx-muted)]">
            Page {page} / {pageInfo.totalPages} · {pageInfo.totalCount} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pageInfo.hasPreviousPage}
              className="btn-secondary py-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Précédent
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pageInfo.hasNextPage}
              className="btn-secondary py-1.5 disabled:opacity-40"
            >
              Suivant <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <CreateSchoolModal
          onClose={() => setModal(false)}
          onCreated={() => { refetch(); setModal(false); }}
        />
      )}
    </div>
  );
}
