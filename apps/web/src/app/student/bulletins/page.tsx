'use client';
import { BulletinDownloadButton } from '@/components/ui/BulletinDownloadButton';
import { BULLETINS_BY_STUDENT_QUERY, MY_STUDENT_PROFILE_QUERY, MY_SCHOOL_QUERY, BULLETIN_STATUS_CHANGED_SUBSCRIPTION } from '@/lib/graphql/queries';
import { useQuery, useSubscription } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { useState } from 'react';
import { FileText, Lock, AlertTriangle, TrendingUp, TrendingDown, Minus, LayoutGrid, ArrowLeftRight } from 'lucide-react';

const TRIMESTRE_LABELS: Record<string, string> = { T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3' };

const MENTION_CONFIG: Record<string, { label: string; color: string; bg: string; hex: string }> = {
  EXCELLENT:   { label: 'Excellent',   color: '#16a34a', bg: '#dcfce7', hex: '#16a34a' },
  TRES_BIEN:   { label: 'Très Bien',   color: '#2563eb', bg: '#dbeafe', hex: '#2563eb' },
  BIEN:        { label: 'Bien',        color: '#0891b2', bg: '#cffafe', hex: '#0891b2' },
  ASSEZ_BIEN:  { label: 'Assez Bien',  color: '#d97706', bg: '#fef9c3', hex: '#d97706' },
  PASSABLE:    { label: 'Passable',    color: '#ea580c', bg: '#ffedd5', hex: '#ea580c' },
  INSUFFISANT: { label: 'Insuffisant', color: '#dc2626', bg: '#fee2e2', hex: '#dc2626' },
};

function moyColor(v: number) {
  if (v >= 14) return '#16a34a';
  if (v >= 10) return '#d97706';
  return '#dc2626';
}

function TrendIcon({ prev, curr }: { prev: number | null; curr: number | null }) {
  if (prev === null || curr === null) return <Minus size={12} style={{ color: '#94a3b8' }} />;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.1) return <Minus size={12} style={{ color: '#94a3b8' }} />;
  if (diff > 0) return <TrendingUp size={12} style={{ color: '#16a34a' }} />;
  return <TrendingDown size={12} style={{ color: '#dc2626' }} />;
}

// ── Vue carte individuelle ────────────────────────────────────
function BulletinCard({ bulletin }: { bulletin: any }) {
  const locked = !bulletin.isDownloadable;
  const unpub  = bulletin.statut !== 'PUBLIE';
  const moy    = bulletin.moyenneGenerale ? parseFloat(bulletin.moyenneGenerale) : null;
  const mention = bulletin.mention ? MENTION_CONFIG[bulletin.mention] : null;

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 16, overflow: 'hidden', opacity: locked && !unpub ? .85 : 1 }}>
      {/* Header couleur */}
      <div style={{ background: unpub ? 'var(--bg-subtle)' : locked ? 'var(--warn-bg)' : 'var(--accent-light)', padding: '16px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--tx-primary)' }}>{TRIMESTRE_LABELS[bulletin.trimestre]}</p>
            <p style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 2 }}>
              {bulletin.generatedAt ? `Généré le ${new Date(bulletin.generatedAt).toLocaleDateString('fr-FR')}` : 'Non généré'}
            </p>
          </div>
          {unpub ? (
            <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--bg-subtle)', color: 'var(--tx-muted)', border: '1px solid var(--bd)', borderRadius: 20, padding: '3px 10px' }}>Non publié</span>
          ) : locked ? (
            <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn)', borderRadius: 20, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Lock size={10} /> Verrouillé
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--ok-bg)', color: 'var(--ok)', border: '1px solid var(--ok)', borderRadius: 20, padding: '3px 10px' }}>Disponible</span>
          )}
        </div>
        {moy !== null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: moyColor(moy), letterSpacing: '-.04em', lineHeight: 1 }}>{moy.toFixed(2)}</span>
            <span style={{ fontSize: 13, color: 'var(--tx-muted)' }}>/20</span>
            {bulletin.rang && <span style={{ fontSize: 13, color: 'var(--tx-secondary)' }}>· Rang <strong>{bulletin.rang}</strong></span>}
            {mention && <span style={{ fontSize: 11, fontWeight: 700, background: mention.bg, color: mention.color, borderRadius: 20, padding: '3px 10px' }}>{mention.label}</span>}
          </div>
        )}
      </div>

      {/* Corps */}
      <div style={{ padding: '14px 20px' }}>
        {locked && !unpub && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--warn-bg)', border: '1px solid var(--warn)', borderRadius: 10, marginBottom: 12, fontSize: 12, color: 'var(--warn)' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <p>Bulletin verrouillé — paiements en attente. Contactez l'administration.</p>
          </div>
        )}
        {(bulletin.details ?? []).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {[...bulletin.details]
              .sort((a: any, b: any) => Number(b.moyenneMatiere) - Number(a.moyenneMatiere))
              .map((d: any, i: number) => {
                const v = parseFloat(d.moyenneMatiere);
                const w = Math.round((v / 20) * 100);
                return (
                  <div key={i} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--bd)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--tx-secondary)', fontWeight: 500, flex: 1 }}>{d.classSubject?.subject?.nom}</span>
                      <span style={{ fontSize: 11, color: 'var(--tx-muted)', marginRight: 10 }}>Coef.{d.coefficient}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: moyColor(v), fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(2)}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${w}%`, background: moyColor(v), borderRadius: 2, transition: 'width .4s' }} />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <BulletinDownloadButton bulletinId={bulletin.id} pdfUrl={bulletin.pdfUrl} isDownloadable={bulletin.isDownloadable && !unpub} size="md" />
        </div>
      </div>
    </div>
  );
}

// ── Vue comparaison T1/T2/T3 côte à côte ─────────────────────
function ComparisonView({ bulletins }: { bulletins: any[] }) {
  const t1 = bulletins.find((b: any) => b.trimestre === 'T1');
  const t2 = bulletins.find((b: any) => b.trimestre === 'T2');
  const t3 = bulletins.find((b: any) => b.trimestre === 'T3');
  const available = [t1, t2, t3].filter(Boolean);

  if (available.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tx-muted)' }}>
      <FileText size={40} style={{ margin: '0 auto 12px', opacity: .3 }} />
      <p style={{ fontWeight: 600 }}>Aucun bulletin disponible</p>
    </div>
  );

  // Collect all subjects across bulletins
  const subjectMap = new Map<string, string>();
  for (const b of available) {
    for (const d of (b.details ?? [])) {
      const id = d.classSubject?.subject?.id;
      const nom = d.classSubject?.subject?.nom;
      if (id && nom) subjectMap.set(id, nom);
    }
  }
  const subjects = Array.from(subjectMap.entries()).map(([id, nom]) => ({ id, nom }));

  // moyennes générales par trimestre
  const moyT = (b: any) => b ? parseFloat(b.moyenneGenerale ?? '0') : null;
  const moyT1 = moyT(t1), moyT2 = moyT(t2), moyT3 = moyT(t3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Résumé progression */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {(['T1','T2','T3'] as const).map((t, i) => {
          const b = bulletins.find((x: any) => x.trimestre === t);
          const moy = b ? parseFloat(b.moyenneGenerale ?? '0') : null;
          const prevMoy = i === 1 ? moyT1 : i === 2 ? moyT2 : null;
          const mention = b?.mention ? MENTION_CONFIG[b.mention] : null;
          return (
            <div key={t} style={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 18px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-muted)', marginBottom: 8 }}>{TRIMESTRE_LABELS[t]}</p>
              {moy !== null ? (
                <>
                  <p style={{ fontSize: 30, fontWeight: 900, color: moyColor(moy), letterSpacing: '-.04em' }}>{moy.toFixed(2)}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                    <TrendIcon prev={prevMoy} curr={moy} />
                    {prevMoy !== null && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: moy - prevMoy > 0 ? '#16a34a' : moy - prevMoy < 0 ? '#dc2626' : '#94a3b8' }}>
                        {moy - prevMoy > 0 ? '+' : ''}{(moy - prevMoy).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {mention && <span style={{ fontSize: 11, fontWeight: 700, color: mention.color, background: mention.bg, borderRadius: 20, padding: '3px 10px', display: 'inline-block', marginTop: 6 }}>{mention.label}</span>}
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--tx-muted)', marginTop: 8 }}>—</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Tableau comparatif par matière */}
      {subjects.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--bd)' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-primary)' }}>Évolution par matière</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', borderBottom: '1px solid var(--bd)', minWidth: 140 }}>Matière</th>
                  {(['T1','T2','T3'] as const).map(t => (
                    <th key={t} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', borderBottom: '1px solid var(--bd)', borderLeft: '1px solid var(--bd)', minWidth: 80 }}>{TRIMESTRE_LABELS[t]}</th>
                  ))}
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)', borderBottom: '1px solid var(--bd)', borderLeft: '1px solid var(--bd)', minWidth: 70 }}>Tendance</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map(({ id, nom }, idx) => {
                  const getSubjectMoy = (b: any) => {
                    if (!b) return null;
                    const d = (b.details ?? []).find((x: any) => x.classSubject?.subject?.id === id);
                    return d ? parseFloat(d.moyenneMatiere) : null;
                  };
                  const v1 = getSubjectMoy(t1), v2 = getSubjectMoy(t2), v3 = getSubjectMoy(t3);
                  const lastAvail = [v3, v2, v1].find(v => v !== null) ?? null;
                  const prevLast = [v3, v2, v1].filter(v => v !== null);
                  const trend = prevLast.length >= 2 ? prevLast[0]! - prevLast[1]! : null;

                  return (
                    <tr key={id} style={{ borderBottom: '1px solid var(--bd)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-subtle)' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--tx-primary)' }}>{nom}</td>
                      {[v1, v2, v3].map((v, i) => (
                        <td key={i} style={{ borderLeft: '1px solid var(--bd)', padding: '8px 12px', textAlign: 'center' }}>
                          {v !== null ? (
                            <span style={{ fontSize: 13, fontWeight: 800, color: moyColor(v), fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(2)}</span>
                          ) : <span style={{ color: 'var(--tx-muted)', fontSize: 12 }}>—</span>}
                        </td>
                      ))}
                      <td style={{ borderLeft: '1px solid var(--bd)', textAlign: 'center', padding: '8px 12px' }}>
                        {trend !== null ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            {trend > 0 ? <TrendingUp size={14} style={{ color: '#16a34a' }} /> : trend < 0 ? <TrendingDown size={14} style={{ color: '#dc2626' }} /> : <Minus size={14} style={{ color: '#94a3b8' }} />}
                            <span style={{ fontSize: 11, fontWeight: 700, color: trend > 0 ? '#16a34a' : trend < 0 ? '#dc2626' : '#94a3b8' }}>
                              {trend > 0 ? '+' : ''}{trend.toFixed(2)}
                            </span>
                          </div>
                        ) : <Minus size={12} style={{ color: '#94a3b8', margin: 'auto' }} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer moyennes générales */}
              <tfoot>
                <tr style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--bd)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--tx-secondary)' }}>Moyenne générale</td>
                  {[moyT1, moyT2, moyT3].map((v, i) => (
                    <td key={i} style={{ borderLeft: '1px solid var(--bd)', padding: '10px 12px', textAlign: 'center' }}>
                      {v ? <span style={{ fontSize: 14, fontWeight: 900, color: moyColor(v), fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(2)}</span> : <span style={{ color: 'var(--tx-muted)' }}>—</span>}
                    </td>
                  ))}
                  <td style={{ borderLeft: '1px solid var(--bd)', textAlign: 'center' }}>
                    {moyT1 !== null && moyT2 !== null ? (
                      <TrendIcon prev={moyT1} curr={moyT3 ?? moyT2} />
                    ) : null}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function StudentBulletinsPage() {
  const schoolId      = tokenStorage.getSchoolId() ?? '';
  const { data: mySchoolData } = useQuery(MY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  const anneeScolaire = mySchoolData?.mySchool?.anneeScolaire ?? '2024-2025';
  const [view, setView] = useState<'cards' | 'compare'>('cards');

  const { data: profileData } = useQuery(MY_STUDENT_PROFILE_QUERY, { variables: { schoolId }, skip: !schoolId });
  const studentId = profileData?.myStudentProfile?.id;
  const { data, loading, refetch } = useQuery(BULLETINS_BY_STUDENT_QUERY, { variables: { studentId, anneeScolaire }, skip: !studentId });

  // Temps réel : dès qu'un bulletin passe en "publié" côté administration,
  // l'élève le voit apparaître sans avoir à recharger la page.
  useSubscription(BULLETIN_STATUS_CHANGED_SUBSCRIPTION, {
    variables: { studentId },
    skip: !studentId,
    onData: () => refetch(),
  });
  const bulletins = data?.bulletinsByStudent ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx-primary)', letterSpacing: '-.03em' }}>Mes Bulletins</h1>
          <p style={{ fontSize: 13, color: 'var(--tx-muted)', marginTop: 3 }}>Année scolaire {anneeScolaire}</p>
        </div>
        {bulletins.filter((b: any) => b.statut === 'PUBLIE').length >= 2 && (
          <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 10, padding: 4, gap: 2 }}>
            {[
              { key: 'cards', icon: <LayoutGrid size={14} />, label: 'Bulletins' },
              { key: 'compare', icon: <ArrowLeftRight size={14} />, label: 'Comparaison' },
            ].map(({ key, icon, label }) => (
              <button key={key} onClick={() => setView(key as any)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all .15s', background: view === key ? 'var(--bg-card)' : 'transparent', color: view === key ? 'var(--tx-primary)' : 'var(--tx-muted)', boxShadow: view === key ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
                {icon} {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, border: '2px solid var(--bd)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : view === 'compare' ? (
        <ComparisonView bulletins={bulletins} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
          {(['T1','T2','T3'] as const).map((t) => {
            const b = bulletins.find((x: any) => x.trimestre === t);
            if (!b) return (
              <div key={t} style={{ background: 'var(--bg-card)', border: '2px dashed var(--bd)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: 'var(--tx-muted)' }}>
                <FileText size={32} style={{ marginBottom: 10, opacity: .4 }} />
                <p style={{ fontWeight: 600, fontSize: 13 }}>{TRIMESTRE_LABELS[t]}</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Non encore généré</p>
              </div>
            );
            return <BulletinCard key={t} bulletin={b} />;
          })}
        </div>
      )}
    </div>
  );
}
