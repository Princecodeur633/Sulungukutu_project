'use client';
import { useToast } from '@/components/ui/Toast';
import { parseGqlError } from '@/lib/errorUtils';
import React from 'react';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { ME_QUERY, UPDATE_PROFILE_MUTATION } from '@/lib/graphql/queries';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import {
  User, Lock, Shield, Mail, Phone, Camera, Check, X, Upload,
} from 'lucide-react';

const TABS = ['Profil', 'Sécurité'] as const;

// Redimensionne l'image en base64 (max 200x200, qualité 0.7)
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img  = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target?.result as string; };
    img.onload = () => {
      const MAX = 200;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const [tab, setTab]   = useState<typeof TABS[number]>('Profil');
  const { data, refetch } = useQuery(ME_QUERY);
  const profile           = data?.me;

  const [form,    setForm]    = useState<any>({});
  const [saved,   setSaved]   = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [updateProfile, { loading }] = useMutation(UPDATE_PROFILE_MUTATION);
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  // Sélection fichier → preview base64
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const b64 = await resizeImage(file);
      setPreview(b64);
      setForm((f: any) => ({ ...f, avatarUrl: b64 }));
    } finally {
      setUploading(false);
    }
  }, []);

  const { addToast } = useToast();
  const handleSave = async () => {
    if (Object.keys(form).length === 0) return;
    try {
      await updateProfile({ variables: { input: form } });
      setSaved(true);
      setPreview(null);
      setForm({});
      setTimeout(() => setSaved(false), 3000);
      refetch();
      addToast({ type: 'success', title: 'Profil mis à jour' });
    } catch(err: any) {
      addToast({ type: 'error', title: 'Erreur mise à jour', message: parseGqlError(err) });
    }
  };

  const currentAvatar = preview ?? profile?.avatarUrl;
  const initials = `${profile?.prenom?.[0] ?? ''}${profile?.nom?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="page-title">Mon profil</h1>
        <p className="page-subtitle">Gérez vos informations personnelles et votre sécurité</p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-[var(--bg-subtle)] p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === t ? 'bg-[var(--bg-card)] text-[var(--tx-primary)] shadow-sm' : 'text-[var(--tx-muted)] hover:text-[var(--tx-secondary)]'}`}
          >
            {t === 'Profil' ? <User size={14} /> : <Lock size={14} />}
            {t}
          </button>
        ))}
      </div>

      {/* ── Onglet Profil ──────────────────────────────────── */}
      {tab === 'Profil' && (
        <div className="card space-y-6">

          {/* Avatar + identité */}
          <div className="flex items-center gap-5">
            {/* Zone avatar cliquable */}
            <div className="relative group flex-shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--info-bg)] flex items-center
                              justify-center text-[var(--tx-primary)] font-black text-2xl ring-2 ring-white
                              shadow-md">
                {currentAvatar
                  ? <img src={currentAvatar} alt="avatar" className="w-full h-full object-cover" />
                  : initials}
              </div>
              {/* Overlay au hover */}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100
                           transition-opacity flex items-center justify-center cursor-pointer"
                title="Changer la photo"
              >
                {uploading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Camera size={20} className="text-white" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {/* Indicateur "nouveau" */}
              {preview && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full flex
                                items-center justify-center shadow">
                  <Upload size={10} className="text-white" />
                </div>
              )}
            </div>

            <div>
              <p className="text-xl font-bold text-[var(--tx-primary)]">
                {profile?.prenom} {profile?.nom}
              </p>
              <p className="text-sm text-[var(--tx-muted)]">{profile?.email}</p>
              {profile?.code && (
                <span className="mt-1 inline-block text-xs font-mono text-[var(--tx-muted)] bg-[var(--bg-subtle)]
                                 border border-[var(--bd)] px-2 py-0.5 rounded-lg">
                  {profile.code}
                </span>
              )}
              <p className="text-xs text-[var(--tx-muted)] mt-1.5 flex items-center gap-1">
                <Camera size={11} />
                Cliquez sur la photo pour en changer
              </p>
            </div>
          </div>

          <div className="divider" />

          {/* Formulaire */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Prénom</label>
              <input className="input" defaultValue={profile?.prenom ?? ''}
                onChange={(e) => set('prenom', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Nom</label>
              <input className="input" defaultValue={profile?.nom ?? ''}
                onChange={(e) => set('nom', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">
              <Mail size={12} className="inline mr-1 text-[var(--tx-muted)]" />Adresse email
            </label>
            <input className="input" type="email" defaultValue={profile?.email ?? ''}
              onChange={(e) => set('email', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">
              <Phone size={12} className="inline mr-1 text-[var(--tx-muted)]" />Téléphone
            </label>
            <input className="input" type="tel" placeholder="+242 06 XXX XX XX"
              defaultValue={profile?.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={loading || Object.keys(form).length === 0}
              className="btn-primary disabled:opacity-50"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sauvegarde…</>
                : <><Check size={15} /> Enregistrer</>}
            </button>
            {Object.keys(form).length > 0 && !loading && (
              <button onClick={() => { setForm({}); setPreview(null); }}
                className="btn-ghost text-[var(--tx-muted)]">
                <X size={15} /> Annuler
              </button>
            )}
            {saved && (
              <span className="text-sm text-[var(--ok)] font-semibold flex items-center gap-1 animate-fade-in">
                <Check size={14} /> Profil mis à jour !
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Onglet Sécurité ────────────────────────────────── */}
      {tab === 'Sécurité' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Shield size={16} className="text-[var(--tx-secondary)]" />
            <h3 className="font-bold text-[var(--tx-secondary)]">Changer le mot de passe</h3>
          </div>
          <ChangePasswordForm onSuccess={() => setSaved(true)} />
          {saved && (
            <p className="text-sm text-[var(--ok)] font-semibold mt-4 flex items-center gap-1.5">
              <Check size={14} /> Mot de passe mis à jour avec succès
            </p>
          )}
        </div>
      )}
    </div>
  );
}
