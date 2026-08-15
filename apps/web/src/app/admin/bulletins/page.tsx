'use client';
import { BulletinDownloadButton } from '@/components/ui/BulletinDownloadButton';
import { parseGqlError } from '@/lib/errorUtils';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  FileText, Play, CheckCircle, RefreshCw,
  Download, Eye, Archive, AlertTriangle
} from 'lucide-react';
import { BULLETINS_BY_CLASS_QUERY, CLASSES_BY_SCHOOL_QUERY, GENERATE_BULLETINS_MUTATION, PUBLISH_BULLETIN_MUTATION, REGENERATE_BULLETIN_MUTATION, MY_SCHOOL_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const MENTION_COLORS: Record<string, string> = {
  EXCELLENT:   'bg-[var(--ok-bg)] text-emerald-800',
  TRES_BIEN:   'bg-[var(--ok-bg)] text-green-800',
  BIEN:        'bg-lime-100 text-lime-800',
  ASSEZ_BIEN:  'bg-yellow-100 text-yellow-800',
  PASSABLE:    'bg-orange-100 text-orange-800',
  INSUFFISANT: 'bg-[var(--err-bg)] text-red-800',
};
const MENTION_LABELS: Record<string, string> = {
  EXCELLENT: 'Excellent', TRES_BIEN: 'Très Bien', BIEN: 'Bien',
  ASSEZ_BIEN: 'Assez Bien', PASSABLE: 'Passable', INSUFFISANT: 'Insuffisant',
};
const TRIMESTRE_LABELS = { T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3' };

function BulletinDetailDrawer({ bulletin, onClose }: { bulletin: any; onClose: () => void }) {
  const student = bulletin.student;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] w-full max-w-md h-full overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-[var(--bd)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--tx-primary)]">
              {student?.membership?.profile?.prenom} {student?.membership?.profile?.nom}
            </h2>
            <p className="text-sm text-[var(--tx-muted)]">
              {TRIMESTRE_LABELS[bulletin.trimestre as keyof typeof TRIMESTRE_LABELS]}
              {' · '} Rang : {bulletin.rang ?? '—'}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--tx-muted)] hover:text-[var(--tx-secondary)] text-xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Moyenne générale */}
          <div className="p-4 bg-[var(--info-bg)] rounded-xl text-center">
            <p className="text-4xl font-black text-[var(--tx-primary)]">
              {parseFloat(bulletin.moyenneGenerale ?? 0).toFixed(2)}
              <span className="text-xl font-normal text-[var(--tx-muted)]">/20</span>
            </p>
            {bulletin.mention && (
              <span className={`badge mt-2 ${MENTION_COLORS[bulletin.mention]}`}>
                {MENTION_LABELS[bulletin.mention]}
              </span>
            )}
            <p className="text-xs text-[var(--tx-secondary)] mt-1">Rang : {bulletin.rang ?? '—'}</p>
          </div>

          {/* Détails par matière */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--tx-secondary)] mb-2">Résultats par matière</h3>
            <div className="space-y-2">
              {(bulletin.details ?? [])
                .sort((a: any, b: any) => b.moyenneMatiere - a.moyenneMatiere)
                .map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3
                                         bg-[var(--bg-subtle)] rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-[var(--tx-primary)]">
                      {d.classSubject?.subject?.nom}
                    </p>
                    <p className="text-xs text-[var(--tx-muted)]">{d.appreciation}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-[var(--tx-primary)]">
                      {parseFloat(d.moyenneMatiere).toFixed(2)}/20
                    </p>
                    <p className="text-xs text-[var(--tx-muted)]">Coef. {d.coefficient}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Téléchargement */}
          <div className={`p-3 rounded-lg border flex items-center justify-between gap-3
            ${bulletin.isDownloadable
              ? 'bg-[var(--ok-bg)] border-[var(--bd)]'
              : 'bg-[var(--warn-bg)] border-amber-200'}`}>
            <div className="flex items-center gap-2">
              {bulletin.isDownloadable
                ? <CheckCircle size={16} className="text-[var(--ok)] flex-shrink-0" />
                : <AlertTriangle size={16} className="text-[var(--warn)] flex-shrink-0" />}
              <p className={`text-xs font-medium
                ${bulletin.isDownloadable ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}`}>
                {bulletin.isDownloadable
                  ? 'Téléchargeable par le parent / élève'
                  : 'Verrouillé — paiements incomplets'}
              </p>
            </div>
            <BulletinDownloadButton
              bulletinId={bulletin.id}
              pdfUrl={bulletin.pdfUrl}
              isDownloadable={bulletin.isDownloadable}
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBulletinsPage() {
  const { addToast } = useToast();
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [confirm, setConfirm] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const askConfirm = (title: string, message: string, fn: () => void) =>
    setConfirm({ open: true, title, message, onConfirm: fn });


  const [classId, setClassId]         = useState('');
  const [trimestre, setTrimestre]     = useState<'T1'|'T2'|'T3'>('T1');
  const [activeBulletin, setActive]   = useState<any>(null);
  const { data: mySchoolData } = useQuery(MY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  const anneeScolaire                 = mySchoolData?.mySchool?.anneeScolaire ?? '2024-2025';

  const { data: classData } = useQuery(CLASSES_BY_SCHOOL_QUERY, {
    variables: { schoolId }, skip: !schoolId,
    pollInterval: 30_000,
  });
  const { data, loading, refetch } = useQuery(BULLETINS_BY_CLASS_QUERY, {
    variables: { classId, trimestre, anneeScolaire },
    skip:      !classId,
  });

  const [exportingGrades, setExportingGrades] = useState(false);

  const handleExportGrades = async () => {
    if (!classId) return;
    setExportingGrades(true);
    try {
      const cls = classes.find((c: any) => c.id === classId);
      const url = `${process.env.NEXT_PUBLIC_API_URL?.replace('/graphql', '') ?? 'http://localhost:4000'}/export/grades?classId=${classId}&trimestre=${trimestre}&className=${encodeURIComponent(cls?.nom ?? '')}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tokenStorage.getToken()}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(body.error ?? `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Notes_${cls?.nom ?? 'export'}_${trimestre}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      addToast({ type: 'success', title: 'Export réussi', message: `Notes ${trimestre} de ${cls?.nom} téléchargées.` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Échec de l\'export', message: err.message });
    } finally { setExportingGrades(false); }
  };

  const [generateBulletins, { loading: generating }] = useMutation(GENERATE_BULLETINS_MUTATION);
  const [publishBulletin]  = useMutation(PUBLISH_BULLETIN_MUTATION);
  const [regenBulletin]    = useMutation(REGENERATE_BULLETIN_MUTATION);

  const classes  = classData?.classesBySchool ?? [];
  const bulletins = data?.bulletinsByClass ?? [];

  const published  = bulletins.filter((b: any) => b.statut === 'PUBLIE').length;
  const brouillons = bulletins.filter((b: any) => b.statut === 'BROUILLON').length;

  const handleGenerate = async () => {
    if (!classId) return;
    try {
      const result = await generateBulletins({
        variables: { input: { classId, trimestre, anneeScolaire } },
      });
      const count = result.data?.generateBulletins?.length ?? 0;
      addToast({ type: 'success', title: `${count} bulletin(s) généré(s)` });
      refetch();
    } catch(err: any) {
      addToast({ type: 'error', title: 'Erreur génération', message: parseGqlError(err) });
    }
  };

  const handlePublishAll = async () => {
    const toBrouillon = bulletins.filter((b: any) => b.statut === 'BROUILLON');
    if (!toBrouillon.length) {
      addToast({ type: 'info', title: 'Aucun bulletin à publier' });
      return;
    }
    try {
      for (const b of toBrouillon) {
        await publishBulletin({ variables: { id: b.id } });
      }
      addToast({ type: 'success', title: `${toBrouillon.length} bulletin(s) publié(s)` });
      refetch();
    } catch(err: any) {
      addToast({ type: 'error', title: 'Erreur publication', message: parseGqlError(err) });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Bulletins</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">Année scolaire {anneeScolaire}</p>
        </div>
        <button
          onClick={handleExportGrades}
          disabled={!classId || exportingGrades}
          className="btn-secondary disabled:opacity-50 flex items-center gap-2"
        >
          <Download size={15} />
          {exportingGrades ? 'Export...' : 'Notes .xlsx'}
        </button>
      </div>

      {/* Filtres & Actions */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <select
          className="input py-1.5 text-sm w-52"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">— Sélectionner une classe —</option>
          {classes.map((c: any) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {(['T1','T2','T3'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTrimestre(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all
                ${trimestre === t ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-card)] border border-[var(--bd)] text-[var(--tx-secondary)] hover:border-indigo-300'}`}
            >
              {TRIMESTRE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          {brouillons > 0 && (
            <button onClick={handlePublishAll} className="btn-secondary">
              <CheckCircle size={15} /> Publier tout ({brouillons})
            </button>
          )}
          <button onClick={handleGenerate} disabled={!classId || generating} className="btn-primary">
            {generating
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Génération...</>
              : <><Play size={15} /> Générer les bulletins</>}
          </button>
          {published > 0 && classId && (
            <button
              onClick={() => {
                const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace('/graphql', '');
                const token = tokenStorage.get() ?? '';
                const params = new URLSearchParams({ classId, trimestre, anneeScolaire });
                const url = `${API_BASE}/export/bulletins-zip?${params}`;
                const a = document.createElement('a');
                a.href = url;
                // pass token via Authorization header requires fetch — use Bearer in URL workaround
                fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                  .then(async r => {
                    if (!r.ok) {
                      const body = await r.json().catch(() => ({ error: `Erreur ${r.status}` }));
                      throw new Error(body.error ?? `Erreur ${r.status}`);
                    }
                    return r.blob();
                  })
                  .then(blob => {
                    a.href = URL.createObjectURL(blob);
                    a.download = `bulletins_${trimestre}_${anneeScolaire}.zip`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  })
                  .catch((err: any) => {
                    addToast({ type: 'error', title: 'Échec du téléchargement ZIP', message: err.message });
                  });
              }}
              className="btn-secondary flex items-center gap-2"
              title={`Télécharger ${published} bulletin(s) publié(s) en ZIP`}
            >
              <Archive size={15} /> ZIP ({published})
            </button>
          )}
        </div>
      </div>

      {/* Stats rapides */}
      {bulletins.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-[var(--tx-primary)]">{bulletins.length}</p>
            <p className="text-sm text-[var(--tx-muted)]">Bulletins générés</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-[var(--ok)]">{published}</p>
            <p className="text-sm text-[var(--tx-muted)]">Publiés</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-[var(--warn)]">{brouillons}</p>
            <p className="text-sm text-[var(--tx-muted)]">Brouillons</p>
          </div>
        </div>
      )}

      {/* Liste bulletins */}
      <div className="card p-0 overflow-hidden">
        {!classId ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
            <FileText size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Sélectionnez une classe pour voir les bulletins</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : bulletins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
            <FileText size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Aucun bulletin généré pour ce trimestre</p>
            <p className="text-sm mt-1">Cliquez sur "Générer les bulletins" pour commencer</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead>
              <tr>
                {['Élève', 'Matricule', 'Moyenne', 'Rang', 'Mention', 'Statut', 'Accès', 'Actions'].map((h) => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...bulletins]
                .sort((a: any, b: any) => (a.rang ?? 999) - (b.rang ?? 999))
                .map((b: any) => (
                <tr key={b.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="table-cell font-semibold text-sm">
                    {b.student?.membership?.profile?.prenom} {b.student?.membership?.profile?.nom}
                  </td>
                  <td className="table-cell text-xs font-mono text-[var(--tx-muted)]">
                    {b.student?.matricule}
                  </td>
                  <td className="table-cell">
                    <span className="font-bold text-[var(--tx-primary)]">
                      {b.moyenneGenerale ? parseFloat(b.moyenneGenerale).toFixed(2) : '—'}
                    </span>
                    <span className="text-[var(--tx-muted)] text-xs">/20</span>
                  </td>
                  <td className="table-cell text-sm">
                    {b.rang ? (
                      <span className={`font-bold ${b.rang <= 3 ? 'text-[var(--warn)]' : 'text-[var(--tx-secondary)]'}`}>
                        {b.rang === 1 ? '🥇' : b.rang === 2 ? '🥈' : b.rang === 3 ? '🥉' : ''} {b.rang}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="table-cell">
                    {b.mention ? (
                      <span className={`badge ${MENTION_COLORS[b.mention]}`}>
                        {MENTION_LABELS[b.mention]}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${b.statut === 'PUBLIE' ? 'badge-success' : b.statut === 'BROUILLON' ? 'badge-warning' : 'badge-neutral'}`}>
                      {b.statut}
                    </span>
                  </td>
                  <td className="table-cell">
                    {b.isDownloadable
                      ? <span className="badge-success badge">Déverrouillé</span>
                      : <span className="badge-danger badge">Verrouillé</span>}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setActive(b)}
                        className="p-1.5 rounded-lg hover:bg-[var(--info-bg)] text-[var(--tx-muted)] hover:text-[var(--tx-primary)]"
                        title="Voir"
                      >
                        <Eye size={14} />
                      </button>
                      {b.statut === 'BROUILLON' && (
                        <button
                          onClick={() => askConfirm('Publier ce bulletin ?', `Le bulletin sera visible par les parents de ${b.student?.membership?.profile?.prenom ?? ''}.`, async () => { await publishBulletin({ variables: { id: b.id } }); setConfirm(c=>({...c,open:false})); refetch(); })}
                          className="p-1.5 rounded-lg hover:bg-[var(--ok-bg)] text-[var(--tx-muted)] hover:text-[var(--ok)]"
                          title="Publier"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => askConfirm('Régénérer ce bulletin ?', 'Les moyennes seront recalculées. Cette action est irréversible.', async () => { await regenBulletin({ variables: { id: b.id } }); setConfirm(c=>({...c,open:false})); refetch(); })}
                        className="p-1.5 rounded-lg hover:bg-[var(--warn-bg)] text-[var(--tx-muted)] hover:text-[var(--warn)]"
                        title="Régénérer"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {activeBulletin && (
        <BulletinDetailDrawer bulletin={activeBulletin} onClose={() => setActive(null)} />
      )}
      <ConfirmModal
        isOpen={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(c => ({ ...c, open: false }))}
      />
    </div>
  );
}
