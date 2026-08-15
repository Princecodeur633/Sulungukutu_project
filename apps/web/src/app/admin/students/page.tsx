'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import {
  UserPlus, Search, Filter, Download,
  Eye, Edit, Trash2, GraduationCap, ChevronLeft, ChevronRight,
  Upload, Copy
} from 'lucide-react';
import {
  STUDENTS_BY_CLASS_QUERY,
  CLASSES_BY_SCHOOL_QUERY,
  CREATE_STUDENT_MUTATION,
  UPDATE_STUDENT_MUTATION,
  TRANSFER_STUDENT_MUTATION,
} from '@/lib/graphql/queries';
import { CsvImport } from '@/components/forms/CsvImport';
import { parseGqlError } from '@/lib/errorUtils';
import { tokenStorage } from '@/lib/apollo/client';
import { useToast } from '@/components/ui/Toast';
import { useActionToast } from '@/hooks/useActionToast';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/graphql', '') ?? 'http://localhost:4000';

const GENDER_LABEL: Record<string, string> = { M: 'Masculin', F: 'Féminin' };

function StudentRow({ student, onView, onEdit }: { student: any; onView: (s: any) => void; onEdit: (s: any) => void }) {
  const profile = student.membership?.profile;
  return (
    <tr className="hover:bg-[var(--bg-subtle)] transition-colors">
      <td className="table-cell">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--info-bg)] flex items-center
                          justify-center text-[var(--tx-primary)] font-bold text-sm flex-shrink-0">
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} className="w-full h-full rounded-full object-cover" />
              : profile?.prenom?.[0] ?? '?'}
          </div>
          <div>
            <p className="font-semibold text-[var(--tx-primary)] text-sm">
              {profile?.prenom} {profile?.nom}
            </p>
            <p className="text-xs text-[var(--tx-muted)]">{profile?.email}</p>
          </div>
        </div>
      </td>
      <td className="table-cell font-mono text-xs text-[var(--tx-secondary)]">{student.matricule}</td>
      <td className="table-cell text-sm">{student.class?.nom ?? '—'}</td>
      <td className="table-cell text-sm">{student.sexe ? GENDER_LABEL[student.sexe] : '—'}</td>
      <td className="table-cell text-sm">
        {student.parents?.length > 0
          ? student.parents.map((p: any) => `${p.parent?.profile?.prenom} ${p.parent?.profile?.nom}`).join(', ')
          : <span className="text-[var(--tx-muted)]">Aucun parent lié</span>}
      </td>
      <td className="table-cell">
        <span className={`badge ${student.membership?.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
          {student.membership?.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
        </span>
      </td>
      <td className="table-cell">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onView(student)}
            className="p-1.5 rounded-lg hover:bg-[var(--info-bg)] text-[var(--tx-muted)]
                       hover:text-[var(--tx-primary)] transition-colors"
            title="Voir la fiche"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => onEdit(student)}
            className="p-1.5 rounded-lg hover:bg-[var(--warn-bg)] text-[var(--tx-muted)]
                       hover:text-[var(--warn)] transition-colors"
            title="Modifier"
          >
            <Edit size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Modal édition élève ────────────────────────────────────────
function EditStudentModal({
  student, classes, onClose, onSaved,
}: {
  student: any; classes: any[]; onClose: () => void; onSaved: () => void;
}) {
  const run = useActionToast();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    classId:       student.class?.id     ?? '',
    sexe:          student.sexe          ?? '',
    dateNaissance: student.dateNaissance
      ? new Date(student.dateNaissance).toISOString().split('T')[0]
      : '',
  });
  const [updateStudent, { loading }] = useMutation(UPDATE_STUDENT_MUTATION);
  const profile = student.membership?.profile;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    try {
      await updateStudent({
        variables: {
          id: student.id,
          input: {
            classId:       form.classId       || undefined,
            sexe:          form.sexe          || undefined,
            dateNaissance: form.dateNaissance ? new Date(form.dateNaissance + 'T00:00:00.000Z').toISOString() : undefined,
          },
        },
      });
      onSaved();
      onClose();
    } catch (err: any) { addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) }); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-[var(--bd)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--tx-primary)]">Modifier l'élève</h2>
            <p className="text-sm text-[var(--tx-muted)]">
              {profile?.prenom} {profile?.nom}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--tx-muted)] hover:text-[var(--tx-secondary)] text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Classe</label>
            <select className="input" value={form.classId}
              onChange={(e) => set('classId', e.target.value)}>
              <option value="">— Inchangé —</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nom} — {c.level?.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Sexe</label>
            <select className="input" value={form.sexe}
              onChange={(e) => set('sexe', e.target.value)}>
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div>
            <label className="label">Date de naissance</label>
            <input className="input" type="date" value={form.dateNaissance}
              onChange={(e) => set('dateNaissance', e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[var(--bd)] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary">
            {loading ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>

    </div>
  );
}


function StudentCreatedModal({
  student,
  onClose,
}: {
  student: any;
  onClose: () => void;
}) {
  const [copiedPassword, setCopiedPassword] = useState<string | null>(null);

  const studentPassword = student?.tempPassword;
  const studentCode     = student?.membership?.profile?.code;
  const studentPhone    = student?.membership?.profile?.phone;
  const parent = student?.parents?.[0]?.parent;
  const parentPassword = student?.parentTempPassword;
  const parentCode     = parent?.profile?.code;
  const parentPhone    = parent?.profile?.phone;
  const parentLabel = [parent?.profile?.prenom, parent?.profile?.nom].filter(Boolean).join(' ').trim();

  const copyPassword = async (value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedPassword(value);
      window.setTimeout(() => setCopiedPassword(null), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg p-6 text-center max-h-[90vh] overflow-y-auto">
        <div className="w-16 h-16 rounded-full bg-[var(--ok-bg)] flex items-center justify-center mx-auto mb-4">
          <UserPlus size={28} className="text-[var(--ok)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--tx-primary)] mb-2">Élève inscrit avec succès</h2>
        <p className="text-[var(--tx-muted)] text-sm mb-5">
          Voici les identifiants temporaires à partager avec l'élève et son parent / tuteur.
          Sans email personnel, la connexion se fait avec l'identifiant ci-dessous
          {studentPhone || parentPhone ? ' (ou le numéro de téléphone renseigné)' : ''}.
        </p>

        <div className="space-y-3 text-left">
          <div className="bg-[var(--bg-subtle)] rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tx-muted)]">Identifiant de connexion élève</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="font-mono text-sm font-bold text-[var(--tx-primary)] break-all">{studentCode}</div>
              <button
                onClick={() => studentCode && copyPassword(studentCode)}
                className="btn-secondary px-3 py-2 text-sm whitespace-nowrap"
              >
                {copiedPassword === studentCode ? '✓ Copié' : <><Copy size={14} className="mr-1" /> Copier</>}
              </button>
            </div>
          </div>
          <div className="bg-[var(--bg-subtle)] rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tx-muted)]">Mot de passe élève</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="font-mono text-sm font-bold text-[var(--tx-primary)] break-all">{studentPassword}</div>
              <button
                onClick={() => studentPassword && copyPassword(studentPassword)}
                className="btn-secondary px-3 py-2 text-sm whitespace-nowrap"
              >
                {copiedPassword === studentPassword ? '✓ Copié' : <><Copy size={14} className="mr-1" /> Copier</>}
              </button>
            </div>
          </div>

          {parentPassword ? (
            <div className="bg-[var(--bg-subtle)] rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tx-muted)]">Identifiant de connexion parent / tuteur</p>
              {parentLabel && <p className="text-sm text-[var(--tx-primary)] mt-1">{parentLabel}</p>}
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="font-mono text-sm font-bold text-[var(--tx-primary)] break-all">{parentCode}</div>
                <button
                  onClick={() => parentCode && copyPassword(parentCode)}
                  className="btn-secondary px-3 py-2 text-sm whitespace-nowrap"
                >
                  {copiedPassword === parentCode ? '✓ Copié' : <><Copy size={14} className="mr-1" /> Copier</>}
                </button>
              </div>
            </div>
          ) : null}
          {parentPassword ? (
            <div className="bg-[var(--bg-subtle)] rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tx-muted)]">Mot de passe parent / tuteur</p>
              {parentLabel && <p className="text-sm text-[var(--tx-primary)] mt-1">{parentLabel}</p>}
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="font-mono text-sm font-bold text-[var(--tx-primary)] break-all">{parentPassword}</div>
                <button
                  onClick={() => parentPassword && copyPassword(parentPassword)}
                  className="btn-secondary px-3 py-2 text-sm whitespace-nowrap"
                >
                  {copiedPassword === parentPassword ? '✓ Copié' : <><Copy size={14} className="mr-1" /> Copier</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--tx-muted)]">Aucun parent / tuteur n’a été renseigné pour cet élève.</div>
          )}
        </div>

        <button onClick={onClose} className="btn-primary w-full justify-center mt-5">Fermer</button>
      </div>
    </div>
  );
}

function CreateStudentModal({
  schoolId,
  classes,
  onClose,
  onCreated,
}: {
  schoolId: string;
  classes:  any[];
  onClose:  () => void;
  onCreated: (createdStudent?: any) => void;
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', phone: '', sexe: '',
    classId: '', dateNaissance: '',
    parentNom: '', parentPrenom: '', parentEmail: '', parentPhone: '', parentLien: 'TUTEUR',
  });
  const [createStudent, { loading }] = useMutation(CREATE_STUDENT_MUTATION);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.nom || !form.prenom || !form.classId) return;
    try {
      const { data } = await createStudent({
        variables: {
          input: {
            schoolId,
            ...form,
            sexe:         form.sexe        || undefined,
            email:        form.email       || undefined,
            phone:        form.phone       || undefined,
            parentEmail:  form.parentEmail || undefined,
            parentPrenom: form.parentPrenom || undefined,
            parentNom:    form.parentNom   || undefined,
            parentPhone:  form.parentPhone || undefined,
            dateNaissance: form.dateNaissance
              ? new Date(form.dateNaissance + 'T00:00:00.000Z').toISOString()
              : undefined,
          },
        },
      });
      onCreated(data?.createStudent);
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh]
                      overflow-y-auto">
        <div className="px-6 py-5 border-b border-[var(--bd)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--tx-primary)]">Inscrire un élève</h2>
          <button onClick={onClose} className="text-[var(--tx-muted)] hover:text-[var(--tx-secondary)] text-xl">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Infos élève */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--tx-muted)] uppercase tracking-wider mb-3">
              Informations de l'élève
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Prénom *</label>
                <input className="input" value={form.prenom} onChange={(e) => set('prenom', e.target.value)} />
              </div>
              <div>
                <label className="label">Nom *</label>
                <input className="input" value={form.nom} onChange={(e) => set('nom', e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Classe *</label>
                <select className="input" value={form.classId} onChange={(e) => set('classId', e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nom} — {c.level?.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sexe</label>
                <select className="input" value={form.sexe} onChange={(e) => set('sexe', e.target.value)}>
                  <option value="">—</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div>
                <label className="label">Date de naissance</label>
                <input className="input" type="date" value={form.dateNaissance} onChange={(e) => set('dateNaissance', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Infos parent */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--tx-muted)] uppercase tracking-wider mb-3">
              Parent / Tuteur (optionnel)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Prénom parent</label>
                <input className="input" value={form.parentPrenom} onChange={(e) => set('parentPrenom', e.target.value)} />
              </div>
              <div>
                <label className="label">Nom parent</label>
                <input className="input" value={form.parentNom} onChange={(e) => set('parentNom', e.target.value)} />
              </div>
              <div>
                <label className="label">Email parent</label>
                <input className="input" type="email" value={form.parentEmail} onChange={(e) => set('parentEmail', e.target.value)} />
              </div>
              <div>
                <label className="label">Téléphone parent</label>
                <input className="input" value={form.parentPhone} onChange={(e) => set('parentPhone', e.target.value)} />
              </div>
              <div>
                <label className="label">Lien</label>
                <select className="input" value={form.parentLien} onChange={(e) => set('parentLien', e.target.value)}>
                  <option value="PERE">Père</option>
                  <option value="MERE">Mère</option>
                  <option value="TUTEUR">Tuteur</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--bd)] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">
            {loading ? 'Inscription...' : 'Inscrire l\'élève'}
          </button>
        </div>
      </div>

    </div>
  );
}

function AdminStudentsPageInner() {
  const { addToast } = useToast();
  const schoolId      = tokenStorage.getSchoolId() ?? '';
  const searchParams  = useSearchParams();

  const [search, setSearch]         = useState('');
  const [selectedClass, setClass]   = useState('');
  const [page, setPage]             = useState(1);
  const [showModal, setShowModal]   = useState(false);
  const [selectedStudent, setStudent] = useState<any>(null);
  const [editStudent, setEdit]        = useState<any>(null);
  const [createdStudent, setCreatedStudent] = useState<any>(null);

  // Sync search from URL query param (?q=...)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);
  const [exporting, setExporting]     = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [showCsvImport, setCsvImport] = useState(false);

  const [updateStudent] = useMutation(UPDATE_STUDENT_MUTATION);
  const [transferStudent] = useMutation(TRANSFER_STUDENT_MUTATION);

  const handleExport = async () => {
    if (!selectedClass) return;
    setExporting(true);
    try {
      const cls  = classes.find((c: any) => c.id === selectedClass);
      const res  = await fetch(
        `${API_URL}/export/students?classId=${selectedClass}&className=${encodeURIComponent(cls?.nom ?? 'Classe')}`,
        { headers: { Authorization: `Bearer ${tokenStorage.getToken()}` } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(body.error ?? `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Eleves_${cls?.nom ?? 'export'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: 'success', title: 'Export réussi', message: `Liste des élèves de ${cls?.nom} téléchargée.` });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Échec de l\'export', message: err.message });
    } finally { setExporting(false); }
  };

  const { data: classData } = useQuery(CLASSES_BY_SCHOOL_QUERY, {
    variables: { schoolId },
    skip:      !schoolId,
  });

  const { data, loading, refetch } = useQuery(STUDENTS_BY_CLASS_QUERY, {
    variables: { classId: selectedClass || undefined, pagination: { page, limit: 25 } },
    skip:      !selectedClass,
  });

  const classes  = classData?.classesBySchool ?? [];
  const students = data?.studentsByClass?.data ?? [];
  const pageInfo = data?.studentsByClass?.pageInfo;

  const filtered = search
    ? students.filter((s: any) => {
        const name = `${s.membership?.profile?.prenom} ${s.membership?.profile?.nom}`.toLowerCase();
        return name.includes(search.toLowerCase()) || s.matricule.includes(search);
      })
    : students;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Élèves</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">
            {pageInfo?.totalCount ?? 0} élèves enregistrés
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={!selectedClass || exporting}
            className="btn-secondary disabled:opacity-50"
          >
            <Download size={15} /> {exporting ? 'Export...' : 'Exporter .xlsx'}
          </button>
          <button onClick={() => setCsvImport(true)} className="btn-secondary" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <UserPlus size={15} /> Inscrire un élève
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
          <input
            className="input pl-9 py-1.5 text-sm"
            placeholder="Rechercher un élève..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input py-1.5 text-sm w-52"
          value={selectedClass}
          onChange={(e) => { setClass(e.target.value); setPage(1); }}
        >
          <option value="">— Toutes les classes —</option>
          {classes.map((c: any) => (
            <option key={c.id} value={c.id}>{c.nom} — {c.level?.nom}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {!selectedClass ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
            <GraduationCap size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Sélectionnez une classe pour voir les élèves</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Élève', 'Matricule', 'Classe', 'Sexe', 'Parent', 'Statut', 'Actions'].map((h) => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-[var(--tx-muted)] text-sm">
                        Aucun élève trouvé
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s: any) => (
                      <StudentRow key={s.id} student={s} onView={setStudent} onEdit={setEdit} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageInfo && pageInfo.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-[var(--bd)] flex items-center justify-between">
                <p className="text-sm text-[var(--tx-muted)]">
                  Page {pageInfo.currentPage} sur {pageInfo.totalPages} ({pageInfo.totalCount} élèves)
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={!pageInfo.hasPreviousPage}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pageInfo.hasNextPage}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editStudent && (
        <EditStudentModal
          student={editStudent}
          classes={classes}
          onClose={() => setEdit(null)}
          onSaved={() => { refetch(); setEdit(null); }}
        />
      )}

      {showModal && (
        <CreateStudentModal
          schoolId={schoolId}
          classes={classes}
          onClose={() => setShowModal(false)}
          onCreated={(student) => {
            setCreatedStudent(student);
            refetch();
          }}
        />
      )}

      {createdStudent && (
        <StudentCreatedModal
          student={createdStudent}
          onClose={() => setCreatedStudent(null)}
        />
      )}

      {/* Fiche élève — slide-over */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"
               onClick={() => setStudent(null)} />
          <div className="relative bg-[var(--bg-card)] w-full max-w-md h-full overflow-y-auto shadow-2xl
                          flex flex-col animate-slide-in">
            <div className="px-6 py-5 border-b border-[var(--bd)] flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-[var(--tx-primary)]">Fiche élève</h2>
              <button onClick={() => setStudent(null)}
                      className="text-[var(--tx-muted)] hover:text-[var(--tx-secondary)] text-xl">×</button>
            </div>

            <div className="flex-1 p-6 space-y-6">
              {/* Avatar + nom */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--info-bg)] flex items-center
                                justify-center text-[var(--tx-primary)] font-bold text-2xl flex-shrink-0">
                  {selectedStudent.membership?.profile?.avatarUrl
                    ? <img src={selectedStudent.membership.profile.avatarUrl}
                           className="w-full h-full rounded-2xl object-cover" alt="" />
                    : selectedStudent.membership?.profile?.prenom?.[0] ?? '?'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--tx-primary)]">
                    {selectedStudent.membership?.profile?.prenom}{' '}
                    {selectedStudent.membership?.profile?.nom}
                  </h3>
                  <p className="text-sm text-[var(--tx-muted)] font-mono">{selectedStudent.matricule}</p>
                  <span className={`badge mt-1 ${
                    selectedStudent.membership?.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'
                  }`}>
                    {selectedStudent.membership?.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>

              {/* Infos */}
              <div className="card bg-[var(--bg-subtle)] border-[var(--bd)] space-y-3 p-4">
                <h4 className="text-xs font-semibold text-[var(--tx-muted)] uppercase tracking-wide">
                  Informations
                </h4>
                {[
                  ['Email', selectedStudent.membership?.profile?.email],
                  ['Téléphone', selectedStudent.membership?.profile?.phone],
                  ['Classe', selectedStudent.class?.nom],
                  ['Sexe', selectedStudent.sexe === 'M' ? 'Masculin' : selectedStudent.sexe === 'F' ? 'Féminin' : '—'],
                  ['Date de naissance', selectedStudent.dateNaissance
                    ? new Date(selectedStudent.dateNaissance).toLocaleDateString('fr-FR')
                    : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[var(--tx-muted)]">{label}</span>
                    <span className="font-medium text-[var(--tx-primary)]">{value ?? '—'}</span>
                  </div>
                ))}
              </div>

              {/* Parents */}
              {(selectedStudent.parents ?? []).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--tx-muted)] uppercase tracking-wide mb-3">
                    Parents / Tuteurs
                  </h4>
                  <div className="space-y-2">
                    {(selectedStudent.parents ?? []).map((p: any) => (
                      <div key={p.id} className="card p-3 bg-[var(--bg-subtle)] border-[var(--bd)]">
                        <p className="font-semibold text-sm text-[var(--tx-primary)]">
                          {p.parent?.profile?.prenom} {p.parent?.profile?.nom}
                          <span className="ml-2 badge badge-neutral text-xs">{p.lien}</span>
                        </p>
                        <p className="text-xs text-[var(--tx-muted)] mt-0.5">{p.parent?.profile?.email}</p>
                        {p.parent?.profile?.phone && (
                          <p className="text-xs text-[var(--tx-muted)]">{p.parent?.profile?.phone}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transfert de classe */}
              <div>
                <h4 className="text-xs font-semibold text-[var(--tx-muted)] uppercase tracking-wide mb-3">
                  Transférer dans une autre classe
                </h4>
                <div className="flex gap-2">
                  <select
                    className="input flex-1 text-sm py-1.5"
                    defaultValue=""
                    onChange={async (e) => {
                      if (!e.target.value) return;
                      const targetClassId = e.target.value;
                      const targetClassName = classes.find((c: any) => c.id === targetClassId)?.nom ?? 'la classe sélectionnée';
                      try {
                        const { data } = await transferStudent({
                          variables: {
                            studentId: selectedStudent.id,
                            newClassId: targetClassId,
                          },
                        });
                        const updatedClass = data?.transferStudentClass?.class;
                        setStudent((prev: any) => prev ? { ...prev, class: updatedClass ?? prev.class } : prev);
                        await refetch();
                        addToast({
                          type: 'success',
                          title: 'Transfert réussi',
                          message: `L'élève a été déplacé vers ${targetClassName}.`,
                        });
                        setStudent(null);
                      } catch (err: any) {
                        addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
                      }
                    }}
                  >
                    <option value="">— Sélectionner une classe —</option>
                    {classes
                      .filter((c: any) => c.id !== selectedStudent.class?.id)
                      .map((c: any) => (
                        <option key={c.id} value={c.id}>{c.nom}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCsvImport && selectedClass && (
        <CsvImport
          schoolId={schoolId}
          classId={selectedClass}
          className={classes.find((c: any) => c.id === selectedClass)?.nom ?? 'Classe'}
          onClose={() => setCsvImport(false)}
          onImported={() => { refetch(); setCsvImport(false); }}
        />
      )}
    </div>
  );
}

export default function AdminStudentsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="spinner" /></div>}>
      <AdminStudentsPageInner />
    </Suspense>
  );
}
