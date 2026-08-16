'use client';

import { CHANGE_PASSWORD_MUTATION } from '@/lib/graphql/queries';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

export function ChangePasswordForm({ onSuccess }: { onSuccess?: () => void }) {
  const [form, setForm]     = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [showOld, setShowOld]   = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD_MUTATION);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const strength = (() => {
    const p = form.newPassword;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'][strength];
  const strengthColor = ['', 'bg-[var(--err)]', 'bg-[var(--warn)]', 'bg-lime-500', 'bg-[var(--ok)]'][strength];

  const handleSubmit = async () => {
    if (!form.oldPassword || !form.newPassword) return;
    if (form.newPassword !== form.confirm) {
      setStatus('error');
      setErrMsg('Les mots de passe ne correspondent pas.');
      return;
    }
    if (strength < 2) {
      setStatus('error');
      setErrMsg('Mot de passe trop faible. Utilisez au moins 8 caractères, une majuscule et un chiffre.');
      return;
    }
    try {
      await changePassword({
        variables: {
          input: { oldPassword: form.oldPassword, newPassword: form.newPassword },
        },
      });
      setStatus('success');
      setForm({ oldPassword: '', newPassword: '', confirm: '' });
      onSuccess?.();
    } catch (err: any) {
      setStatus('error');
      setErrMsg(err.message ?? 'Une erreur est survenue.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Statut */}
      {status === 'success' && (
        <div className="flex items-center gap-2.5 p-3 bg-[var(--ok-bg)] border border-[var(--bd)]
                        rounded-xl text-[var(--ok)] text-sm">
          <CheckCircle size={16} className="flex-shrink-0" />
          Mot de passe modifié avec succès !
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2.5 p-3 bg-[var(--err-bg)] border border-red-200
                        rounded-xl text-[var(--err)] text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          {errMsg}
        </div>
      )}

      {/* Champ mot de passe actuel */}
      <div>
        <label className="label">Mot de passe actuel</label>
        <div className="relative">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
          <input
            className="input pl-9 pr-10"
            type={showOld ? 'text' : 'password'}
            value={form.oldPassword}
            onChange={(e) => { set('oldPassword', e.target.value); setStatus('idle'); }}
          />
          <button
            type="button"
            onClick={() => setShowOld((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)] hover:text-[var(--tx-secondary)]"
          >
            {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Nouveau mot de passe */}
      <div>
        <label className="label">Nouveau mot de passe</label>
        <div className="relative">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
          <input
            className="input pl-9 pr-10"
            type={showNew ? 'text' : 'password'}
            value={form.newPassword}
            onChange={(e) => { set('newPassword', e.target.value); setStatus('idle'); }}
          />
          <button
            type="button"
            onClick={() => setShowNew((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)] hover:text-[var(--tx-secondary)]"
          >
            {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {/* Jauge force */}
        {form.newPassword.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}
                  className={`flex-1 h-1 rounded-full transition-all
                    ${i <= strength ? strengthColor : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <p className={`text-xs font-medium
              ${strength >= 3 ? 'text-[var(--ok)]' : strength >= 2 ? 'text-[var(--warn)]' : 'text-[var(--err)]'}`}>
              Force : {strengthLabel}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation */}
      <div>
        <label className="label">Confirmer le nouveau mot de passe</label>
        <div className="relative">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
          <input
            className={`input pl-9 ${
              form.confirm && form.confirm !== form.newPassword
                ? 'border-red-300 focus:ring-red-200'
                : form.confirm && form.confirm === form.newPassword
                ? 'border-emerald-300 focus:ring-emerald-200'
                : ''}`}
            type="password"
            value={form.confirm}
            onChange={(e) => { set('confirm', e.target.value); setStatus('idle'); }}
          />
          {form.confirm && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {form.confirm === form.newPassword
                ? <CheckCircle size={15} className="text-[var(--ok)]" />
                : <AlertCircle size={15} className="text-red-400" />}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !form.oldPassword || !form.newPassword || form.newPassword !== form.confirm}
        className="btn-primary w-full justify-center disabled:opacity-50"
      >
        {loading ? 'Modification…' : 'Changer le mot de passe'}
      </button>
    </div>
  );
}
