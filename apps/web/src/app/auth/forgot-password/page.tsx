'use client';
import React from 'react';

import Image from 'next/image';
import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { REQUEST_PASSWORD_RESET_MUTATION } from '@/lib/graphql/queries';
import { User, ArrowLeft, CheckCircle, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { chartColors } from '@/lib/chartColors';
import logoImg from '@/img/logo.png';

export default function ForgotPasswordPage() {
  const [identifiant, setIdentifiant] = useState('');
  const [sent,  setSent]    = useState(false);
  const [error, setError]   = useState('');

  const [requestReset, { loading }] = useMutation(REQUEST_PASSWORD_RESET_MUTATION);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifiant.trim()) { setError('Veuillez saisir votre email, identifiant ou téléphone.'); return; }

    try {
      await requestReset({ variables: { identifiant: identifiant.trim() } });
      setSent(true);
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', padding: 12 }}>
      <div style={{ width: '100%', maxWidth: 420, borderRadius: 'var(--r-shell)', overflow: 'hidden', boxShadow: 'var(--sh-lg)', border: '1px solid var(--bd)', background: 'var(--bg-card)' }}>

        <div style={{
          padding: '28px 32px 24px',
          backgroundImage: 'linear-gradient(165deg, var(--bg-sidebar-grad-start) 0%, var(--bg-sidebar-grad-end) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image src={logoImg} alt="Sulungukutu" width={19} height={19} />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: '.02em', fontFamily: "'Sora', sans-serif" }}>SULUNGUKUTU</span>
          </div>
        </div>

        <div style={{ padding: '28px 32px 32px' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--ok-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle size={26} style={{ color: 'var(--ok)' }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-primary)', marginBottom: 8, fontFamily: "'Sora', sans-serif" }}>Demande envoyée</h2>
              <p style={{ color: 'var(--tx-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
                Si un compte correspond à <strong style={{ color: 'var(--tx-primary)' }}>{identifiant}</strong> et possède un email personnel, un lien de réinitialisation (valable 1 heure) vient d'y être envoyé.
              </p>
              <div style={{ background: 'var(--warn-bg)', borderRadius: 10, padding: 12, marginBottom: 20, textAlign: 'left', display: 'flex', gap: 10 }}>
                <KeyRound size={15} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: 'var(--tx-secondary)', lineHeight: 1.6 }}>
                  Pas d'email personnel ? Aucun message n'a pu être envoyé — demandez à l'administration de votre établissement de réinitialiser votre mot de passe en personne.
                </p>
              </div>
              <Link href="/auth/login" className="btn-primary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowLeft size={15} /> Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <div style={{ width: 28, height: 4, borderRadius: 2, background: chartColors.amber, marginBottom: 16 }} />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-primary)', marginBottom: 6, fontFamily: "'Sora', sans-serif" }}>Mot de passe oublié ?</h2>
              <p style={{ color: 'var(--tx-muted)', fontSize: 13, marginBottom: 22 }}>
                Indiquez votre email, votre identifiant (ex: STU-A1B2) ou votre téléphone.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Email, identifiant ou téléphone</label>
                  <div style={{ position: 'relative' }}>
                    <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      name="identifiant"
                      className="input"
                      style={{ paddingLeft: 36 }}
                      placeholder="votre@email.com, STU-A1B2 ou 06 XXX XX XX"
                      value={identifiant}
                      onChange={(e) => setIdentifiant(e.target.value)}
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--err-bg)', border: '1px solid var(--err)', borderRadius: 8, fontSize: 13, color: 'var(--err)' }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px' }} disabled={loading}>
                  {loading ? 'Envoi en cours…' : 'Réinitialiser le mot de passe'}
                </button>
              </form>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <Link href="/auth/login" style={{ fontSize: 13, color: 'var(--tx-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ArrowLeft size={13} /> Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
