'use client';
import React, { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Lock, Eye, EyeOff, AlertCircle, ArrowRight, User } from 'lucide-react';
import { LOGIN_MUTATION } from '@/lib/graphql/queries';
import { tokenStorage, apolloClient } from '@/lib/apollo/client';
import { chartColors } from '@/lib/chartColors';
import logoImg from '@/img/logo.png';

const ROLE_DASH: Record<string,string> = {
  SUPER_ADMIN: '/superadmin/dashboard', ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard', PARENT: '/parent/dashboard', STUDENT: '/student/dashboard',
};

function LoginPageInner() {
  const router       = useRouter();
  const params       = useSearchParams();
  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [login, { loading }]    = useMutation(LOGIN_MUTATION);

  useEffect(() => {
    if (params.get('session_expired') === '1') setError('Votre session a expiré. Reconnectez-vous.');
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const { data } = await login({ variables: { input: { identifiant, password } } });
      const result = data?.login;
      if (!result?.accessToken) { setError('Réponse invalide du serveur'); return; }
      // Purge le cache Apollo AVANT de poser le nouveau token : sans ça, si un
      // autre compte était connecté juste avant dans le même navigateur (sans
      // passer par « Déconnexion »), les anciennes données restaient en cache
      // et pouvaient s'afficher brièvement, voire rester bloquées, pour le
      // nouveau compte.
      await apolloClient.clearStore();
      tokenStorage.set(result.accessToken);
      const memberships = result.availableMemberships ?? [];
      if (memberships.length > 1) {
        sessionStorage.setItem('pending_memberships', JSON.stringify(memberships));
        sessionStorage.setItem('pending_refresh_token', result.refreshToken);
        router.push('/auth/workspace'); return;
      }
      const membership = memberships[0] ?? result.currentMembership;
      if (membership) { tokenStorage.setSchoolId(membership.school.id); router.push(ROLE_DASH[membership.role] ?? '/'); }
    } catch (err: any) {
      setError(err?.graphQLErrors?.[0]?.message ?? 'Email ou mot de passe incorrect');
    }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', padding: 12 }}>
    <div style={{ display: 'flex', width: '100%', maxWidth: 1180, minHeight: 'min(720px, 100dvh - 24px)', borderRadius: 'var(--r-shell)', overflow: 'hidden', boxShadow: 'var(--sh-lg)', border: '1px solid var(--bd)' }}>

      {/* Gauche — identité de marque, ancrée dans le vrai objet du métier : le bulletin */}
      <div className="hidden lg:flex flex-col justify-between" style={{
        width: '46%', padding: '40px 44px',
        backgroundImage: 'linear-gradient(165deg, var(--bg-sidebar-grad-start) 0%, var(--bg-sidebar-grad-end) 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image src={logoImg} alt="Sulungukutu" width={20} height={20} />
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '.02em', fontFamily: "'Sora', sans-serif" }}>SULUNGUKUTU</span>
        </div>

        <div style={{ position: 'relative' }}>
          <p style={{ color: chartColors.amber, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Trimestre 2 · 2025-2026
          </p>
          <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-.02em', marginBottom: 14, fontFamily: "'Sora', sans-serif" }}>
            Le bulletin arrive<br />avant la fin du trimestre.
          </h1>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 14, lineHeight: 1.7, maxWidth: 300, marginBottom: 28 }}>
            Notes, présences et paiements suivis en temps réel — plus besoin d'attendre le conseil de classe pour savoir où en est un élève.
          </p>

          {/* Maquette d'un vrai bulletin — le signature element, pas une illustration générique */}
          <div style={{
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 14, padding: 18, maxWidth: 300, position: 'relative',
            transform: 'rotate(-1.5deg)', backdropFilter: 'blur(2px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>N. Malonga</p>
                <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 10.5 }}>3ème B · Bulletin trimestriel</p>
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', border: `2px solid ${chartColors.emerald}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transform: 'rotate(8deg)', color: chartColors.emerald, fontSize: 9, fontWeight: 800,
                letterSpacing: '.02em', textAlign: 'center', lineHeight: 1.1,
              }}>
                ADMIS
              </div>
            </div>
            {[
              { m: 'Mathématiques', v: 16.5 },
              { m: 'Français',      v: 13.0 },
              { m: 'Sciences Physiques', v: 9.5 },
            ].map((row) => {
              const c = row.v >= 14 ? chartColors.emerald : row.v >= 10 ? chartColors.amber : chartColors.rose;
              return (
                <div key={row.m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  <span style={{ color: 'rgba(255,255,255,.65)', fontSize: 11.5 }}>{row.m}</span>
                  <span style={{ color: c, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{row.v.toFixed(1)}/20</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.15)' }}>
              <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Moyenne générale</span>
              <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>13.4<span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>/20</span></span>
            </div>
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,.25)', fontSize: 11.5, position: 'relative' }}>
          © 2026 Sulungukutu — Gestion scolaire, Congo-Brazzaville
        </p>
      </div>

      {/* Droite — Formulaire */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px, 5vw, 48px)', background: 'var(--bg-card)' }}>
        <div style={{ width: '100%', maxWidth: 360 }} className="animate-slide-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image src={logoImg} alt="Sulungukutu" width={20} height={20} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--tx-primary)', fontFamily: "'Sora', sans-serif" }}>SULUNGUKUTU</span>
          </div>

          <div style={{ width: 32, height: 4, borderRadius: 2, background: chartColors.amber, marginBottom: 18 }} />
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--tx-primary)', marginBottom: 6, fontFamily: "'Sora', sans-serif" }}>
            Accédez à votre espace
          </h2>
          <p style={{ fontSize: 13, color: 'var(--tx-muted)', marginBottom: 26 }}>
            Administration, enseignant, parent ou élève — un seul accès.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                background: 'var(--err-bg)', border: '1px solid var(--err)',
                borderRadius: 8, fontSize: 13, color: 'var(--err)',
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <div>
              <label className="label">Email, identifiant ou téléphone</label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)', pointerEvents: 'none' }} />
                <input type="text" name="identifiant" value={identifiant} onChange={e => setIdentifiant(e.target.value)}
                  placeholder="votre@email.com, STU-A1B2 ou 06 XXX XX XX" required autoComplete="username"
                  className="input" style={{ paddingLeft: 36 }} />
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--tx-muted)', marginTop: 5 }}>
                Pas d'email ? Utilisez l'identifiant remis lors de votre inscription (ex: STU-A1B2), ou votre numéro de téléphone.
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 5 }}>
                <label className="label" style={{ marginBottom: 0 }}>Mot de passe</label>
                <Link href="/auth/forgot-password" style={{ fontSize: 12, color: 'var(--tx-muted)', transition: 'color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--tx-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx-muted)')}
                >Oublié ?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)', pointerEvents: 'none' }} />
                <input type={showPass ? 'text' : 'password'} name="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  className="input" style={{ paddingLeft: 36, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-muted)', padding: 4, transition: 'color .15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--tx-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx-muted)')}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '11px', fontSize: 14, marginTop: 4 }}>
              {loading ? (
                <><div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> Connexion…</>
              ) : (
                <><span>Se connecter</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <div className="spinner" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}

