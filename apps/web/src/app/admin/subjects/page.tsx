'use client';
import { parseGqlError } from '@/lib/errorUtils';

import { CREATE_SUBJECT_MUTATION, DELETE_SUBJECT_MUTATION, SUBJECTS_BY_SCHOOL_QUERY, UPDATE_SUBJECT_MUTATION } from '@/lib/graphql/queries';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { useToast } from '@/components/ui/Toast';
import { Layers, Plus, Edit, Trash2, BookOpen } from 'lucide-react';

function SubjectModal({
  schoolId, subject, onClose, onSaved,
}: {
  schoolId: string; subject?: any; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!subject;
  const [nom, setNom]         = useState(subject?.nom ?? '');
  const [desc, setDesc]       = useState(subject?.description ?? '');
  const [create, { loading: lc }] = useMutation(CREATE_SUBJECT_MUTATION);
  const [update, { loading: lu }] = useMutation(UPDATE_SUBJECT_MUTATION);

  const handleSave = async () => {
    if (!nom.trim()) return;
    if (isEdit) {
      await update({ variables: { id: subject.id, input: { nom, description: desc } } });
    } else {
      await create({ variables: { input: { schoolId, nom, description: desc } } });
    }
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-[var(--tx-primary)] mb-5">
          {isEdit ? 'Modifier la matière' : 'Nouvelle matière'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label">Nom de la matière *</label>
            <input className="input" value={nom} onChange={(e) => setNom(e.target.value)}
              placeholder="ex: Mathématiques, SVT, Histoire-Géo..." />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Description optionnelle..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={handleSave} disabled={lc || lu} className="btn-primary">
            {lc || lu ? 'Sauvegarde...' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSubjectsPage() {
  const { addToast } = useToast();
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [modal, setModal] = useState<{ open: boolean; subject?: any }>({ open: false });

  const { data, loading, refetch } = useQuery(SUBJECTS_BY_SCHOOL_QUERY, {
    variables: { schoolId }, skip: !schoolId,
  });
  const [deleteSubject] = useMutation(DELETE_SUBJECT_MUTATION);

  const subjects = data?.subjectsBySchool ?? [];

  const   handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer "${nom}" ? Cette action est irréversible.`)) return;
    try {
      await deleteSubject({ variables: { id } });
      addToast({ type: 'success', title: `Matière "${nom}" supprimée` });
      refetch();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Matières</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">{subjects.length} matière(s) configurée(s)</p>
        </div>
        <button onClick={() => setModal({ open: true })} className="btn-primary">
          <Plus size={15} /> Nouvelle matière
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <Layers size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Aucune matière configurée</p>
          <p className="text-sm mt-1">Créez des matières pour les assigner aux classes</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {subjects.map((s: any) => (
            <div key={s.id} className="card-hover group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                  <BookOpen size={18} className="text-[var(--tx-secondary)]" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setModal({ open: true, subject: s })}
                    className="p-1.5 rounded-lg hover:bg-[var(--warn-bg)] text-[var(--tx-muted)] hover:text-[var(--warn)]"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id, s.nom)}
                    className="p-1.5 rounded-lg hover:bg-[var(--err-bg)] text-[var(--tx-muted)] hover:text-[var(--err)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-[var(--tx-primary)]">{s.nom}</h3>
              {s.description && (
                <p className="text-sm text-[var(--tx-muted)] mt-1 line-clamp-2">{s.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <SubjectModal
          schoolId={schoolId}
          subject={modal.subject}
          onClose={() => setModal({ open: false })}
          onSaved={() => { refetch(); setModal({ open: false }); }}
        />
      )}
    </div>
  );
}
