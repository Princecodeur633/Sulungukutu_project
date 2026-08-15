'use client';
import React from 'react';
import { useState, useRef } from 'react';
import { tokenStorage } from '@/lib/apollo/client';
import { Upload, X, CheckCircle, AlertCircle, FileSpreadsheet, Download, Loader2 } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace('/graphql', '');

interface CsvRow {
  prenom: string; nom: string; sexe: string; dateNaissance: string;
  email?: string; telephone?: string; classe?: string;
  parentPrenom?: string; parentNom?: string; parentEmail?: string; parentPhone?: string;
}

interface ImportResult { success: number; errors: { row: number; msg: string }[]; }

const CSV_TEMPLATE = `prenom,nom,sexe,dateNaissance,email,telephone,parentPrenom,parentNom,parentEmail,parentPhone
Jean,Dupont,M,2008-05-12,jean.dupont@edu.local,,Marie,Dupont,marie.dupont@gmail.com,+242 06 123 456
Amina,Koubilat,F,2009-03-20,,,Paul,Koubilat,,+242 05 987 654`;

interface Props {
  schoolId: string;
  classId: string;
  className: string;
  onClose: () => void;
  onImported: () => void;
}

export function CsvImport({ schoolId, classId, className, onClose, onImported }: Props) {
  const [rows, setRows]       = useState<CsvRow[]>([]);
  const [step, setStep]       = useState<'upload' | 'preview' | 'done'>('upload');
  const [result, setResult]   = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [isRunning, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): CsvRow[] => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj as CsvRow;
    }).filter(r => r.prenom && r.nom);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) { setRows(parsed); setStep('preview'); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) handleFile(file);
  };

  const runImport = async () => {
    setRunning(true);
    setProgress(10);
    try {
      const header = "prenom,nom,sexe,datenaissance,email,telephone,parentemail,parentnom,parentprenom,parentphone,parentlien";
      const csvLines = rows.map(r => [
        r.prenom, r.nom, r.sexe||"M", r.dateNaissance||"",
        r.email||"",
        r.telephone||"",
        (r as any).parentemail||r.parentEmail||"",
        (r as any).parentnom||r.parentNom||"",
        (r as any).parentprenom||r.parentPrenom||"",
        (r as any).parentphone||(r as any).parentPhone||"",
        ""
      ].join(","));
      const csvBody = [header,...csvLines].join("\n");
      const token = tokenStorage.get();
      const params = new URLSearchParams({schoolId, token: token??""});
      if (classId) params.set("classId", classId);
      setProgress(30);
      const res = await fetch(API_BASE+"/import/students?"+params, {
        method: "POST",
        headers: {"Content-Type":"text/csv"},
        body: csvBody,
      });
      setProgress(80);
      if (!res.ok) { const e=await res.json().catch(()=>({error:"HTTP "+res.status})); throw new Error(e.error??"Erreur "+res.status); }
      const data = await res.json();
      const errors = (data.results??[]).filter((r:any)=>!r.success).map((r:any)=>({row:r.row,msg:r.error??"Erreur"}));
      setProgress(100);
      setResult({success:data.success??0, errors});
      setStep("done");
      if ((data.success??0)>0) onImported();
    } catch(e:any) {
      setResult({success:0,errors:[{row:0,msg:e.message}]});
      setStep("done");
    } finally { setRunning(false); }
  };
  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'modele_import_eleves.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div style={{
        position: 'relative', background: 'var(--bg-card)',
        borderRadius: 16, padding: 0, width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflow: 'hidden',
        boxShadow: 'var(--sh-xl)', border: '1px solid var(--bd)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={18} style={{ color: 'var(--tx-muted)' }} />
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-primary)' }}>Import CSV — {className}</h2>
              <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 1 }}>Importez plusieurs élèves en une fois</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed var(--bd-strong)', borderRadius: 12,
                  padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all .15s', background: 'var(--bg-subtle)',
                }}>
                <Upload size={32} style={{ color: 'var(--tx-muted)', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-primary)', marginBottom: 4 }}>
                  Glissez votre fichier CSV ici
                </p>
                <p style={{ fontSize: 12, color: 'var(--tx-muted)' }}>ou cliquez pour sélectionner</p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              <button onClick={downloadTemplate} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
                borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--bd)',
                cursor: 'pointer', fontSize: 13, color: 'var(--tx-secondary)', width: 'fit-content',
              }}>
                <Download size={14} /> Télécharger le modèle CSV
              </button>

              <div style={{ background: 'var(--info-bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(37,99,235,.15)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--info)', marginBottom: 6 }}>Format attendu :</p>
                <p style={{ fontSize: 11, color: 'var(--info)', fontFamily: 'monospace', lineHeight: 1.6 }}>
                  prenom, nom, sexe (M/F), dateNaissance (AAAA-MM-JJ),<br/>
                  email, telephone, parentPrenom, parentNom, parentEmail, parentPhone
                </p>
                <p style={{ fontSize: 11, color: 'var(--info)', marginTop: 6 }}>
                  Email ou téléphone suffit (pas besoin des deux) — pour l'élève comme pour le parent.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-primary)' }}>
                  {rows.length} élève{rows.length > 1 ? 's' : ''} détecté{rows.length > 1 ? 's' : ''}
                </p>
                <button onClick={() => setStep('upload')} style={{ fontSize: 12, color: 'var(--tx-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Changer le fichier
                </button>
              </div>

              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10, fontSize: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', position: 'sticky', top: 0 }}>
                      {['Prénom', 'Nom', 'Sexe', 'Naissance', 'Parent'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--tx-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--bd)' }}>
                        <td style={{ padding: '7px 12px', color: 'var(--tx-primary)', fontWeight: 500 }}>{r.prenom}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--tx-primary)', fontWeight: 500 }}>{r.nom}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--tx-secondary)' }}>{r.sexe}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--tx-secondary)' }}>{r.dateNaissance || '—'}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--tx-muted)' }}>
                          {(r.parentPrenom || (r as any).parentprenom) ? `${(r.parentPrenom || (r as any).parentprenom)} ${r.parentNom || (r as any).parentnom || ''}`.trim() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isRunning && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--tx-muted)' }}>
                    <span>Import en cours…</span><span>{progress}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--ok)', borderRadius: 999, width: `${progress}%`, transition: 'width .3s ease' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Done */}
          {step === 'done' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px', borderRadius: 12,
                background: result.success > 0 ? 'var(--ok-bg)' : 'var(--err-bg)',
                border: `1px solid ${result.success > 0 ? 'rgba(22,163,74,.2)' : 'rgba(220,38,38,.2)'}`,
              }}>
                <CheckCircle size={28} style={{ color: 'var(--ok)', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-primary)' }}>
                    {result.success} élève{result.success > 1 ? 's' : ''} importé{result.success > 1 ? 's' : ''} avec succès
                  </p>
                  {result.errors.length > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginTop: 2 }}>
                      {result.errors.length} erreur{result.errors.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div style={{ border: '1px solid var(--err-bg)', borderRadius: 10, overflow: 'hidden' }}>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderTop: i > 0 ? '1px solid var(--bd)' : 'none', background: 'var(--err-bg)' }}>
                      <AlertCircle size={14} style={{ color: 'var(--err)', flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 12, color: 'var(--err)' }}>Ligne {e.row}: {e.msg}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          {step === 'done' ? (
            <button onClick={onClose} className="btn-primary">Fermer</button>
          ) : (
            <>
              <button onClick={onClose} className="btn-secondary" disabled={isRunning}>Annuler</button>
              {step === 'preview' && (
                <button onClick={runImport} disabled={isRunning} className="btn-primary" style={{ minWidth: 120 }}>
                  {isRunning ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Import…
                    </span>
                  ) : `Importer ${rows.length} élève${rows.length > 1 ? 's' : ''}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
