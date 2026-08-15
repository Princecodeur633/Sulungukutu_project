'use client';
import React from 'react';
import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { CLASSES_BY_SCHOOL_QUERY, MY_SCHOOL_QUERY } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { useToast } from '@/components/ui/Toast';
import {
  Download, FileSpreadsheet, Users, TrendingUp,
  CreditCard, CheckCircle, Loader2, AlertCircle,
} from 'lucide-react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql').replace('/graphql', '');
const TRIMESTRES = ['T1', 'T2', 'T3'] as const;

// Génère les années scolaires autour de l'année en cours (au lieu d'une liste
// figée ["2024-2025","2023-2024","2022-2023"] qui devenait obsolète chaque
// nouvelle rentrée). Une année scolaire "démarre" en septembre : avant août,
// on considère qu'on est encore sur l'année scolaire précédente.
function buildAnneeOptions(currentAnnee?: string | null): string[] {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const years = [1, 0, -1, -2].map((offset) => `${startYear + offset}-${startYear + offset + 1}`);
  if (currentAnnee && !years.includes(currentAnnee)) years.unshift(currentAnnee);
  return Array.from(new Set(years));
}

type ExportType = 'students' | 'grades' | 'payments';

interface ExportConfig {
  type:           ExportType;
  label:          string;
  description:    string;
  icon:           React.ReactNode;
  colorClass:     string;
  needsTrimestre?: boolean;
  needsAnnee?:    boolean;
}

const EXPORTS: ExportConfig[] = [
  {
    type:        'students',
    label:       'Liste des élèves',
    description: 'Exporte la liste complète des élèves avec coordonnées parents',
    icon:        <Users size={22} />,
    colorClass:  'text-[var(--info)] bg-[var(--info-bg)]',
  },
  {
    type:           'grades',
    label:          'Relevé de notes',
    description:    'Tableau de notes par matière pour le trimestre sélectionné',
    icon:           <TrendingUp size={22} />,
    colorClass:     'text-violet-600 bg-violet-50',
    needsTrimestre: true,
  },
  {
    type:        'payments',
    label:       'État des paiements',
    description: 'Récapitulatif des 9 mensualités par élève (payé / impayé / exonéré)',
    icon:        <CreditCard size={22} />,
    colorClass:  'text-[var(--ok)] bg-[var(--ok-bg)]',
    needsAnnee:  true,
  },
];

export default function AdminExportsPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const toast    = useToast();

  const [classId, setClassId]       = useState('');
  const [trimestre, setTrimestre]   = useState<'T1' | 'T2' | 'T3'>('T1');
  const [anneeScolaire, setAnnee]   = useState(() => buildAnneeOptions()[0]);
  const [loading, setLoading]       = useState<ExportType | null>(null);
  const [done, setDone]             = useState<ExportType | null>(null);

  const { data: mySchoolData } = useQuery(MY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  const realAnnee = mySchoolData?.mySchool?.anneeScolaire ?? null;
  const ANNEES = buildAnneeOptions(realAnnee);
  // Initialise la sélection sur l'année réelle de l'établissement dès qu'elle est chargée
  const [realAnneeSynced, setRealAnneeSynced] = useState(false);
  React.useEffect(() => {
    if (realAnnee && !realAnneeSynced) { setAnnee(realAnnee); setRealAnneeSynced(true); }
  }, [realAnnee, realAnneeSynced]);

  const { data: classData } = useQuery(CLASSES_BY_SCHOOL_QUERY, {
    variables: { schoolId },
    skip:      !schoolId,
  });

  const classes     = classData?.classesBySchool ?? [];
  const activeClass = classes.find((c: any) => c.id === classId);
  const token       = tokenStorage.getToken() ?? '';

  const handleExport = async (type: ExportType) => {
    if (!classId) {
      toast.warning('Classe requise', 'Veuillez sélectionner une classe avant d\'exporter.');
      return;
    }

    setLoading(type);

    const params = new URLSearchParams({
      classId,
      className:    activeClass?.nom ?? 'Classe',
      school:       activeClass?.level?.nom ?? 'École',
      trimestre,
      anneeScolaire,
    });

    try {
      const res = await fetch(`${API_URL}/export/${type}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(body.error ?? `Erreur ${res.status}`);
      }

      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const rawName  = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1];
      const filename = rawName ? decodeURIComponent(rawName) : `export_${type}.xlsx`;

      const link    = document.createElement('a');
      link.href     = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      setDone(type);
      setTimeout(() => setDone(null), 3500);
      toast.success('Export réussi', `Fichier "${filename}" téléchargé.`);

    } catch (err: any) {
      toast.error('Échec de l\'export', err.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Exports</h1>
        <p className="page-subtitle">Téléchargez les données au format Excel (.xlsx)</p>
      </div>

      {/* Paramètres */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-[var(--tx-secondary)] flex items-center gap-2">
          <FileSpreadsheet size={16} /> Paramètres d'export
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Classe *</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Trimestre</label>
            <div className="flex gap-1">
              {TRIMESTRES.map((t) => (
                <button key={t} onClick={() => setTrimestre(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all
                    ${trimestre === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-[var(--bg-card)] text-[var(--tx-secondary)] border-[var(--bd)] hover:border-indigo-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Année scolaire</label>
            <select className="input" value={anneeScolaire} onChange={(e) => setAnnee(e.target.value)}>
              {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {!classId && (
          <p className="text-xs text-[var(--warn)] flex items-center gap-1.5">
            <AlertCircle size={13} /> Sélectionnez une classe pour activer les exports
          </p>
        )}
      </div>

      {/* Cartes export */}
      <div className="grid grid-cols-1 gap-4">
        {EXPORTS.map((exp) => {
          const isLoading = loading === exp.type;
          const isDone    = done === exp.type;

          return (
            <div key={exp.type}
              className={`card flex items-center gap-5 transition-all
                ${!classId ? 'opacity-50 pointer-events-none' : ''}`}>

              <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                              flex-shrink-0 ${exp.colorClass}`}>
                {exp.icon}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[var(--tx-primary)]">{exp.label}</h3>
                <p className="text-sm text-[var(--tx-muted)] mt-0.5">{exp.description}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--tx-muted)] flex-wrap">
                  {activeClass && (
                    <span className="font-medium text-[var(--tx-secondary)]">Classe : {activeClass.nom}</span>
                  )}
                  {exp.needsTrimestre && <span>Trimestre : <strong>{trimestre}</strong></span>}
                  {exp.needsAnnee    && <span>Année : <strong>{anneeScolaire}</strong></span>}
                </div>
              </div>

              <button
                onClick={() => handleExport(exp.type)}
                disabled={isLoading || !classId}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                  flex-shrink-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  ${isDone ? 'bg-[var(--ok)] text-white' : 'btn-primary'}`}>
                {isLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> En cours…</>
                ) : isDone ? (
                  <><CheckCircle size={16} /> Téléchargé !</>
                ) : (
                  <><Download size={16} /> Exporter .xlsx</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card bg-[var(--bg-subtle)] p-4">
        <p className="text-xs text-[var(--tx-muted)] leading-relaxed">
          <strong className="text-[var(--tx-secondary)]">Format :</strong> Fichiers Excel (.xlsx)
          compatibles avec Microsoft Excel, LibreOffice et Google Sheets.{' '}
          <strong className="text-[var(--tx-secondary)]">Confidentialité :</strong> Ces données
          contiennent des informations personnelles — conservez-les en sécurité.
        </p>
      </div>
    </div>
  );
}
