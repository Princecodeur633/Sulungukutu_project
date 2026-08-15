'use client';
import { useToast } from '@/components/ui/Toast';
import { parseGqlError } from '@/lib/errorUtils';

import { ANNOUNCEMENTS_QUERY, CREATE_ANNOUNCEMENT_MUTATION, DELETE_ANNOUNCEMENT_MUTATION, UPDATE_ANNOUNCEMENT_MUTATION } from '@/lib/graphql/queries';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { Megaphone, Plus, Edit, Trash2, Clock, Users } from 'lucide-react';

const CIBLE_LABELS: Record<string, string> = {
  ALL: 'Tous', PARENTS: 'Parents', TEACHERS: 'Enseignants',
  STUDENTS: 'Élèves', STAFF: 'Personnel',
};
const CIBLE_COLORS: Record<string, string> = {
  ALL: 'badge-info', PARENTS: 'badge-warning', TEACHERS: 'badge-success',
  STUDENTS: 'bg-[var(--bg-subtle)] text-[var(--tx-secondary)]', STAFF: 'badge-neutral',
};

function AnnouncementModal({
  schoolId, announcement, onClose, onSaved,
}: { schoolId: string; announcement?: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!announcement;
  const [titre, setTitre]   = useState(announcement?.titre ?? '');
  const [contenu, setContenu] = useState(announcement?.contenu ?? '');
  const [cible, setCible]   = useState(announcement?.cible ?? 'ALL');

  const [create, { loading: lc }] = useMutation(CREATE_ANNOUNCEMENT_MUTATION);
  const [update, { loading: lu }] = useMutation(UPDATE_ANNOUNCEMENT_MUTATION);

  const { addToast } = useToast();
  const handleSave = async () => {
    if (!titre.trim() || !contenu.trim()) {
      addToast({ type: 'warning', title: 'Champs manquants', message: 'Le titre et le contenu sont obligatoires.' });
      return;
    }
    const input = { schoolId, titre, contenu, cible };
    try {
      if (isEdit) await update({ variables: { id: announcement.id, input } });
      else await create({ variables: { input } });
      addToast({ type: 'success', title: isEdit ? 'Annonce modifiée' : 'Annonce publiée' });
      onSaved(); onClose();
    } catch(err: any) {
      addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-[var(--tx-primary)] mb-5">
          {isEdit ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">Titre *</label>
            <input className="input" value={titre} onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre de l'annonce..." />
          </div>
          <div>
            <label className="label">Contenu *</label>
            <textarea className="input resize-none" rows={5} value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder="Rédigez votre annonce..." />
          </div>
          <div>
            <label className="label">Destinataires</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(CIBLE_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setCible(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all
                    ${cible === k ? 'border-[var(--bd-strong)] bg-[var(--info-bg)] text-[var(--tx-primary)]' : 'border-[var(--bd)] text-[var(--tx-secondary)] hover:border-indigo-300'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={handleSave} disabled={lc || lu} className="btn-primary">
            {lc || lu ? 'Publication...' : isEdit ? 'Enregistrer' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [modal, setModal] = useState<{ open: boolean; ann?: any }>({ open: false });

  const { data, loading, refetch } = useQuery(ANNOUNCEMENTS_QUERY, {
    variables: { schoolId }, skip: !schoolId,
  });
  const [deleteAnn] = useMutation(DELETE_ANNOUNCEMENT_MUTATION);

  const announcements = data?.announcementsBySchool ?? [];

  const { addToast: notifyDelete } = useToast();
  const handleDelete = async (id: string) => {
    try {
      await deleteAnn({ variables: { id } });
      notifyDelete({ type: 'success', title: 'Annonce supprimée' });
      refetch();
    } catch(err: any) {
      notifyDelete({ type: 'error', title: 'Erreur suppression', message: parseGqlError(err) });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Annonces</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">{announcements.length} annonce(s) publiée(s)</p>
        </div>
        <button onClick={() => setModal({ open: true })} className="btn-primary">
          <Plus size={15} /> Nouvelle annonce
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <Megaphone size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Aucune annonce publiée</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a: any) => (
            <div key={a.id} className="card group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[var(--warn-bg)] flex items-center justify-center flex-shrink-0">
                    <Megaphone size={18} className="text-[var(--warn)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-[var(--tx-primary)]">{a.titre}</h3>
                      <span className={`badge ${CIBLE_COLORS[a.cible] ?? 'badge-neutral'} text-xs`}>
                        <Users size={10} className="mr-1" />
                        {CIBLE_LABELS[a.cible] ?? a.cible}
                      </span>
                    </div>
                    <p className="text-[var(--tx-secondary)] text-sm leading-relaxed">{a.contenu}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--tx-muted)]">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(a.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <span>·</span>
                      <span>{a.auteur?.profile?.prenom} {a.auteur?.profile?.nom}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => setModal({ open: true, ann: a })}
                    className="p-1.5 rounded-lg hover:bg-[var(--warn-bg)] text-[var(--tx-muted)] hover:text-[var(--warn)]"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 rounded-lg hover:bg-[var(--err-bg)] text-[var(--tx-muted)] hover:text-[var(--err)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <AnnouncementModal
          schoolId={schoolId}
          announcement={modal.ann}
          onClose={() => setModal({ open: false })}
          onSaved={() => { refetch(); setModal({ open: false }); }}
        />
      )}
    </div>
  );
}
