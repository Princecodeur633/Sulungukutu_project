'use client';
import React from 'react';
import { parseGqlError } from '@/lib/errorUtils';

import { ALL_SCHOOLS_QUERY, CREATE_SCHOOL_MUTATION } from '@/lib/graphql/queries';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Building2, Plus, ChevronRight, Search,
  Phone, MapPin, ChevronLeft, X, Copy, Check,
  User, GraduationCap, CalendarDays, KeyRound,
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

const CYCLES = [
  { id: 'PRIMAIRE' as const, label: 'Primaire', hint: 'CP1 → CM2' },
  { id: 'COLLEGE'  as const, label: 'Collège',  hint: '6ème → 3ème' },
  { id: 'LYCEE'    as const, label: 'Lycée',    hint: '2nde → Terminale' },
];

function anneeScolaireOptions(): string[] {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return [start - 1, start, start + 1].map((y) => `${y}-${y + 1}`);
}

function Field({
  label, required, hint, error, children,
}: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span style={{ color: 'var(--err)', marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {error
        ? <p style={{ fontSize: 11.5, color: 'var(--err)', marginTop: 5, lineHeight: 1.4 }}>{error}</p>
        : hint
          ? <p style={{ fontSize: 11.5, color: 'var(--tx-muted)', marginTop: 5, lineHeight: 1.45 }}>{hint}</p>
          : null}
    </div>
  );
}

function CreateSchoolModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    nom: '', adresse: '', telephone: '', anneeScolaire: guessCurrentAnneeScolaire(),
    adminEmail: '', adminPhone: '', adminNom: '', adminPrenom: '',
  });
  const [cycles, setCycles] = useState<Array<'PRIMAIRE' | 'COLLEGE' | 'LYCEE'>>(['PRIMAIRE', 'COLLEGE', 'LYCEE']);
  const [divisionCount, setDivisionCount] = useState(4);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createSchool, { loading }] = useMutation(CREATE_SCHOOL_MUTATION);
  const [done, setDone] = useState<any>(null);
  const [copied, setCopied] = React.useState<'pwd' | 'all' | null>(null);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      if (!e[k] && !(k === 'adminEmail' || k === 'adminPhone' ? e.contact : false)) return e;
      const next = { ...e };
      delete next[k];
      if (k === 'adminEmail' || k === 'adminPhone') delete next.contact;
      return next;
    });
  };

  const toggleCycle = (id: 'PRIMAIRE' | 'COLLEGE' | 'LYCEE') => {
    setCycles((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      return next;
    });
    setErrors((e) => {
      if (!e.cycles) return e;
      const next = { ...e };
      delete next.cycles;
      return next;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.nom.trim().length < 2) e.nom = 'Indiquez le nom de l’établissement.';
    if (!/^\d{4}-\d{4}$/.test(form.anneeScolaire)) e.anneeScolaire = 'Format attendu : 2025-2026';
    if (cycles.length === 0) e.cycles = 'Sélectionnez au moins un cycle.';
    if (form.adminPrenom.trim().length < 2) e.adminPrenom = 'Prénom requis.';
    if (form.adminNom.trim().length < 2) e.adminNom = 'Nom requis.';
    if (!form.adminEmail.trim() && !form.adminPhone.trim()) {
      e.contact = 'Indiquez un email ou un numéro de téléphone.';
    } else if (form.adminEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim())) {
      e.adminEmail = 'Adresse email invalide.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    try {
      const { data } = await createSchool({
        variables: {
          input: {
            nom:           form.nom.trim(),
            adresse:       form.adresse.trim() || undefined,
            telephone:     form.telephone.trim() || undefined,
            anneeScolaire: form.anneeScolaire,
            adminEmail:    form.adminEmail.trim() || undefined,
            adminPhone:    form.adminPhone.trim() || undefined,
            adminNom:      form.adminNom.trim(),
            adminPrenom:   form.adminPrenom.trim(),
            cycles,
            divisions:     Array.from({ length: divisionCount }, (_, i) => String(i + 1)),
          },
        },
      });
      setDone(data?.createSchool);
      onCreated();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Création impossible', message: parseGqlError(err) });
    }
  };

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !done) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, onClose]);

  const copyText = (value: string, kind: 'pwd' | 'all') => {
    navigator.clipboard?.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2200);
  };

  const inputStyle = (hasError?: boolean): React.CSSProperties => ({
    borderColor: hasError ? 'var(--err)' : undefined,
    boxShadow: hasError ? '0 0 0 3px color-mix(in srgb, var(--err) 18%, transparent)' : undefined,
  });

  const shell = (inner: React.ReactNode, opts?: { dismissOnOverlay?: boolean }) => (
    <div
      className="modal-overlay animate-fade-in"
      onClick={(e) => {
        if (opts?.dismissOnOverlay !== false && e.target === e.currentTarget && !done) onClose();
      }}
    >
      <div
        className="modal-box animate-scale-in"
        style={{ maxWidth: 680, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'min(92vh, 820px)' }}
        role="dialog"
        aria-labelledby="create-school-title"
      >
        {inner}
      </div>
    </div>
  );

  if (done) {
    const identifiant = done.adminIdentifiant ?? '';
    const password = done.adminTempPassword ?? '';
    const bloc = `Établissement : ${done.school?.nom ?? ''}\nIdentifiant : ${identifiant}\nMot de passe : ${password}`;
    return shell(
      <>
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--bd)', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px',
            background: 'var(--ok-bg)', border: '1px solid var(--bd)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={24} style={{ color: 'var(--ok)' }} />
          </div>
          <h2 id="create-school-title" style={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--tx-primary)' }}>
            Établissement créé
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--tx-muted)', marginTop: 4 }}>
            {done.school?.nom}
            {done.school?.code ? <span style={{ marginLeft: 8, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>· {done.school.code}</span> : null}
          </p>
        </div>
        <div style={{ padding: 22, overflowY: 'auto' }}>
          <div style={{
            background: 'var(--warn-bg)', border: '1.5px solid var(--warn)',
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <KeyRound size={15} style={{ color: 'var(--warn)' }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)', fontFamily: 'Sora, sans-serif' }}>
                Identifiants administrateur
              </p>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--tx-muted)', lineHeight: 1.55, marginBottom: 14 }}>
              Remettez-les en main propre. Le mot de passe temporaire{' '}
              <strong style={{ color: 'var(--tx-primary)' }}>ne sera plus visible</strong> après fermeture de cette fenêtre.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 10.5, color: 'var(--tx-muted)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>Identifiant</p>
                <p style={{ fontSize: 14, fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: 'var(--tx-primary)', userSelect: 'all' }}>{identifiant}</p>
              </div>
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 10,
                padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <div>
                  <p style={{ fontSize: 10.5, color: 'var(--tx-muted)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 3 }}>Mot de passe temporaire</p>
                  <p style={{ fontSize: 20, fontFamily: 'ui-monospace, monospace', fontWeight: 800, letterSpacing: '.12em', color: 'var(--tx-primary)', userSelect: 'all' }}>{password}</p>
                </div>
                <button type="button" onClick={() => copyText(password, 'pwd')} className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12, flexShrink: 0 }}>
                  {copied === 'pwd' ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
                </button>
              </div>
            </div>
            {!done.hasRealEmail && (
              <p style={{ fontSize: 12.5, color: 'var(--warn)', marginTop: 12, lineHeight: 1.45 }}>
                Aucun email personnel — rien n’a été envoyé. Communiquez ces identifiants directement.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => copyText(bloc, 'all')}
            >
              {copied === 'all' ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier le récapitulatif</>}
            </button>
            <button type="button" onClick={onClose} className="btn-primary" style={{ flex: 1 }}>
              J&apos;ai noté — Fermer
            </button>
          </div>
        </div>
      </>,
      { dismissOnOverlay: false },
    );
  }

  const years = anneeScolaireOptions();
  if (!years.includes(form.anneeScolaire)) years.unshift(form.anneeScolaire);

  return shell(
    <>
      <div style={{
        padding: '18px 22px', borderBottom: '1px solid var(--bd)',
        display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Building2 size={18} style={{ color: 'var(--accent)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="create-school-title" style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--tx-primary)', letterSpacing: '-.02em' }}>
            Nouvel établissement
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--tx-muted)', marginTop: 3, lineHeight: 1.45 }}>
            L’école, ses cycles et le compte du premier administrateur.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--tx-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--tx-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-muted)'; }}
        >
          <X size={16} />
        </button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
      >
        <div style={{ overflowY: 'auto', padding: '18px 22px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section style={{
          background: 'var(--bg-subtle)', border: '1px solid var(--bd)', borderRadius: 14, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Building2 size={14} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tx-secondary)' }}>
              Établissement
            </h3>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Nom de l’établissement" required error={errors.nom}>
              <input
                className="input"
                autoFocus
                value={form.nom}
                onChange={(e) => set('nom', e.target.value)}
                placeholder="Ex. Collège Saint-Exupéry"
                style={inputStyle(!!errors.nom)}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Adresse" hint="Facultatif">
                <input
                  className="input"
                  value={form.adresse}
                  onChange={(e) => set('adresse', e.target.value)}
                  placeholder="Quartier, ville"
                />
              </Field>
              <Field label="Téléphone de l’école" hint="Facultatif">
                <input
                  className="input"
                  value={form.telephone}
                  onChange={(e) => set('telephone', e.target.value)}
                  placeholder="+242 06 xxx xx xx"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Année scolaire" required error={errors.anneeScolaire}>
                <div style={{ position: 'relative' }}>
                  <CalendarDays size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)', pointerEvents: 'none' }} />
                  <select
                    className="input"
                    value={form.anneeScolaire}
                    onChange={(e) => set('anneeScolaire', e.target.value)}
                    style={{ ...inputStyle(!!errors.anneeScolaire), paddingLeft: 34 }}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}{y === guessCurrentAnneeScolaire() ? '  — en cours' : ''}</option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Classes par niveau" hint="Sections numériques (1, 2, 3…)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setDivisionCount(n)}
                      style={{
                        padding: '9px 8px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${divisionCount === n ? 'var(--accent)' : 'var(--bd)'}`,
                        background: divisionCount === n ? 'var(--accent-light)' : 'var(--bg-card)',
                        color: divisionCount === n ? 'var(--accent)' : 'var(--tx-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Cycles à ouvrir" required error={errors.cycles} hint="Le programme national correspondant sera préparé automatiquement.">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {CYCLES.map((c) => {
                  const on = cycles.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCycle(c.id)}
                      style={{
                        textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                        border: `1.5px solid ${on ? 'var(--accent)' : 'var(--bd)'}`,
                        background: on ? 'var(--accent-light)' : 'var(--bg-card)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <GraduationCap size={13} style={{ color: on ? 'var(--accent)' : 'var(--tx-muted)' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: on ? 'var(--accent)' : 'var(--tx-primary)' }}>{c.label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--tx-muted)' }}>{c.hint}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </section>

        <section style={{
          background: 'var(--bg-subtle)', border: '1px solid var(--bd)', borderRadius: 14, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <User size={14} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tx-secondary)' }}>
              Premier administrateur
            </h3>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Prénom" required error={errors.adminPrenom}>
                <input
                  className="input"
                  value={form.adminPrenom}
                  onChange={(e) => set('adminPrenom', e.target.value)}
                  placeholder="Jean"
                  style={inputStyle(!!errors.adminPrenom)}
                />
              </Field>
              <Field label="Nom" required error={errors.adminNom}>
                <input
                  className="input"
                  value={form.adminNom}
                  onChange={(e) => set('adminNom', e.target.value)}
                  placeholder="Mbemba"
                  style={inputStyle(!!errors.adminNom)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Email" error={errors.adminEmail || errors.contact}>
                <input
                  className="input"
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => set('adminEmail', e.target.value)}
                  placeholder="admin@ecole.cg"
                  style={inputStyle(!!errors.adminEmail || !!errors.contact)}
                />
              </Field>
              <Field label="Téléphone" hint="Email ou téléphone — au moins l’un des deux." error={errors.contact && !errors.adminEmail ? errors.contact : undefined}>
                <input
                  className="input"
                  type="tel"
                  value={form.adminPhone}
                  onChange={(e) => set('adminPhone', e.target.value)}
                  placeholder="06 xxx xx xx"
                  style={inputStyle(!!errors.contact)}
                />
              </Field>
            </div>
          </div>
        </section>
        </div>

        <div style={{
          padding: '14px 22px', borderTop: '1px solid var(--bd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          flexShrink: 0, background: 'var(--bg-card)',
        }}>
          <p style={{ fontSize: 11.5, color: 'var(--tx-muted)', lineHeight: 1.4, maxWidth: 320 }}>
            Un mot de passe temporaire sera affiché ensuite — à transmettre à l’administrateur.
          </p>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Création…' : 'Créer l’établissement'}
            </button>
          </div>
        </div>
      </form>
    </>,
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
          onCreated={() => { refetch(); }}
        />
      )}
    </div>
  );
}
