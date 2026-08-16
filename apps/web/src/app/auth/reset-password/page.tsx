'use client';
import React, { useState, Suspense } from 'react';
import { useMutation } from '@apollo/client';
import { CONFIRM_PASSWORD_RESET_MUTATION, LOGIN_MUTATION, CHANGE_PASSWORD_MUTATION } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import Image from 'next/image';
import { Lock, Mail, Eye, EyeOff, CheckCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import logoImg from '@/img/logo.png';
import { chartColors } from '@/lib/chartColors';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const resetToken   = searchParams.get('token') ?? '';

  const [step, setStep]             = useState<'form' | 'done'>('form');
  const [email, setEmail]           = useState('');
  const [tempPwd, setTempPwd]       = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError]           = useState('');
  const [showTemp, setShowTemp]     = useState(false);
  const [showNew, setShowNew]       = useState(false);

  const [confirmReset]   = useMutation(CONFIRM_PASSWORD_RESET_MUTATION);
  const [login]          = useMutation(LOGIN_MUTATION);
  const [changePassword] = useMutation(CHANGE_PASSWORD_MUTATION);

  const strength = (() => {
    if (newPwd.length === 0) return 0;
    let s = 0;
    if (newPwd.length >= 8)           s++;
    if (/[A-Z]/.test(newPwd))         s++;
    if (/[0-9]/.test(newPwd))         s++;
    if (/[^A-Za-z0-9]/.test(newPwd))  s++;
    return s;
  })();

  const strengthLabel = ['', 'Faible', 'Moyen', 'Fort', 'Très fort'][strength];
  const strengthColor = ['', chartColors.rose, chartColors.amber, chartColors.sky, chartColors.emerald][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPwd.length < 8) { setError('Le nouveau mot de passe doit comporter au moins 8 caractères.'); return; }
    if (newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas.'); return; }

    try {
      if (resetToken) {
        await confirmReset({ variables: { token: resetToken, newPassword: newPwd } });
      } else {
        if (!email.trim())   { setError('Veuillez saisir votre adresse email ou identifiant.'); return; }
        if (!tempPwd.trim()) { setError('Veuillez saisir votre mot de passe temporaire.'); return; }
        if (newPwd === tempPwd) { setError('Le nouveau mot de passe doit être différent du mot de passe temporaire.'); return; }

        const { data: loginData } = await login({
          variables: { input: { identifiant: email.trim(), password: tempPwd } },
        });
        if (!loginData?.login?.accessToken) throw new Error('Connexion échouée.');
        tokenStorage.set(loginData.login.accessToken);
        await changePassword({
          variables: { input: { oldPassword: tempPwd, newPassword: newPwd } },
        });
        tokenStorage.clear();
      }
      setStep('done');
    } catch (err: any) {
      const msg = err?.graphQLErrors?.[0]?.message ?? err?.message ?? 'Une erreur est survenue.';
      if (msg.includes('Invalid credentials') || msg.includes('mot de passe incorrect')) {
        setError('Mot de passe temporaire incorrect. Vérifiez l\'email reçu.');
      } else {
        setError(msg);
      }
    }
  };

  const submitDisabled = resetToken
    ? !newPwd || !confirmPwd
    : !email || !tempPwd || !newPwd || !confirmPwd;

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-app)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', width: 56, height: 56, borderRadius: 14,
            backgroundImage: 'linear-gradient(165deg, var(--bg-sidebar-grad-start) 0%, var(--bg-sidebar-grad-end) 100%)',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--sh-md)', marginBottom: 12,
          }}>
            <Image src={logoImg} alt="Sulungukutu" width={32} height={32} className="object-contain" />
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx-primary)', letterSpacing: '-.02em', fontFamily: "'Sora', sans-serif" }}>Sulungukutu</h1>
        </div>

        <div style={{
          background: 'var(--bg-card)', borderRadius: 20,
          boxShadow: '0 8px 40px rgba(0,0,0,.10)',
          border: '1px solid var(--bd)', overflow: 'hidden',
        }}>

          {step === 'done' ? (
            <div style={{ padding: 36, textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--ok-bg)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <CheckCircle size={36} color="var(--ok)" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx-primary)', marginBottom: 10 }}>
                Mot de passe mis à jour !
              </h2>
              <p style={{ fontSize: 13, color: 'var(--tx-muted)', lineHeight: 1.6, marginBottom: 28 }}>
                Votre mot de passe a été changé avec succès. Vous pouvez maintenant vous connecter avec vos nouveaux identifiants.
              </p>
              <Link href="/auth/login" className="btn-primary" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', textDecoration: 'none',
              }}>
                Se connecter →
              </Link>
            </div>
          ) : (
            <>
              <div style={{
                padding: '24px 28px 20px',
                borderBottom: '1px solid var(--bd)',
                background: 'var(--bg-subtle)',
              }}>
                <div style={{ width: 28, height: 4, borderRadius: 2, background: chartColors.amber, marginBottom: 10 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <ShieldCheck size={20} style={{ color: 'var(--tx-primary)' }} />
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx-primary)', fontFamily: "'Sora', sans-serif" }}>
                    Définir mon mot de passe
                  </h2>
                </div>
                <p style={{ fontSize: 12, color: 'var(--tx-muted)', lineHeight: 1.5 }}>
                  {resetToken
                    ? 'Choisissez un nouveau mot de passe pour finaliser la réinitialisation.'
                    : 'Vous avez reçu un mot de passe temporaire (remise par l’administration). Saisissez-le ci-dessous puis choisissez un nouveau mot de passe.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                {!resetToken && (
                  <>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', display: 'block', marginBottom: 6 }}>
                        Email, identifiant ou téléphone
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)' }} />
                        <input
                          type="text"
                          name="identifiant"
                          className="input"
                          style={{ paddingLeft: 36 }}
                          placeholder="votre@email.com, STU-A1B2 ou 06 XXX XX XX"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          autoFocus
                          autoComplete="username"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', display: 'block', marginBottom: 6 }}>
                        Mot de passe temporaire <span style={{ color: 'var(--tx-muted)', fontWeight: 400 }}>(reçu par email ou remis par l'administration)</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)' }} />
                        <input
                          type={showTemp ? 'text' : 'password'}
                          className="input"
                          style={{ paddingLeft: 36, paddingRight: 40 }}
                          placeholder="••••••••"
                          value={tempPwd}
                          onChange={e => setTempPwd(e.target.value)}
                          autoComplete="current-password"
                        />
                        <button type="button" onClick={() => setShowTemp(v => !v)}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-muted)', padding: 4 }}>
                          {showTemp ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px dashed var(--bd)', margin: '0 -4px' }} />
                  </>
                )}

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', display: 'block', marginBottom: 6 }}>
                    Nouveau mot de passe
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)' }} />
                    <input
                      type={showNew ? 'text' : 'password'}
                      className="input"
                      style={{ paddingLeft: 36, paddingRight: 40 }}
                      placeholder="Min. 8 caractères"
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      autoComplete="new-password"
                      autoFocus={!!resetToken}
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-muted)', padding: 4 }}>
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {newPwd.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 99,
                            background: i <= strength ? strengthColor : 'var(--bd)',
                            transition: 'background .2s',
                          }} />
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: strengthColor, fontWeight: 600 }}>{strengthLabel}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', display: 'block', marginBottom: 6 }}>
                    Confirmer le nouveau mot de passe
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)' }} />
                    <input
                      type="password"
                      className="input"
                      style={{
                        paddingLeft: 36,
                        borderColor: confirmPwd && confirmPwd !== newPwd ? 'var(--err)' : undefined,
                      }}
                      placeholder="••••••••"
                      value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  {confirmPwd && confirmPwd !== newPwd && (
                    <p style={{ fontSize: 11, color: 'var(--err)', marginTop: 4 }}>Les mots de passe ne correspondent pas</p>
                  )}
                </div>

                {error && (
                  <div style={{
                    background: 'var(--err-bg)', border: '1px solid rgba(220,38,38,.2)',
                    borderRadius: 8, padding: '10px 14px',
                    fontSize: 12, color: 'var(--err)', lineHeight: 1.5,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: 14 }}
                  disabled={submitDisabled}
                >
                  Enregistrer mon mot de passe
                </button>

                <div style={{ textAlign: 'center' }}>
                  <Link href="/auth/login" style={{
                    fontSize: 12, color: 'var(--tx-muted)',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    textDecoration: 'none', transition: 'color .15s',
                  }}>
                    <ArrowLeft size={13} /> Retour à la connexion
                  </Link>
                </div>

              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
