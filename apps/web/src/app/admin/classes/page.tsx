'use client';
import { parseGqlError } from '@/lib/errorUtils';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { BookOpen, Plus, Users, Layers, Pencil, Trash2, X } from 'lucide-react';
import { FormModal, FormField, FormSection, FormGrid, FormActions } from '@/components/ui/FormModal';
import {
  ASSIGN_CLASS_SUBJECT_MUTATION, CLASSES_BY_SCHOOL_QUERY, CREATE_CLASS_MUTATION,
  CREATE_LEVEL_MUTATION, DELETE_CLASS_MUTATION, LEVELS_BY_SCHOOL_QUERY,
  REMOVE_CLASS_SUBJECT_MUTATION, SCHOOL_MEMBERS_QUERY, SUBJECTS_BY_SCHOOL_QUERY,
  UPDATE_CLASS_MUTATION, MY_SCHOOL_QUERY,
} from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { useToast } from '@/components/ui/Toast';

const LEVEL_TYPE_LABELS: Record<string, string> = {
  PRIMAIRE: 'Primaire', COLLEGE: 'Collège', LYCEE: 'Lycée',
};

function ManageClassDrawer({
  cls, schoolId, subjects, teachers, onClose, onSaved,
}: {
  cls: any; schoolId: string; subjects: any[]; teachers: any[];
  onClose: () => void; onSaved: () => void;
}) {
  const { addToast }                    = useToast();
  const [subjectId, setSubjectId]       = useState('');
  const [teacherId, setTeacherId]       = useState('');
  const [coef, setCoef]                 = useState('1');
  const [hpw, setHpw]                   = useState('');
  const [assignCS, { loading }]         = useMutation(ASSIGN_CLASS_SUBJECT_MUTATION);
  const [removeCS, { loading: removing }] = useMutation(REMOVE_CLASS_SUBJECT_MUTATION);

  const handleAssign = async () => {
    if (!subjectId || !teacherId) return;
    try {
      await assignCS({
        variables: {
          input: {
            classId: cls.id, subjectId,
            teacherMembershipId: teacherId,
            coefficient: parseFloat(coef),
            hoursPerWeek: hpw ? parseInt(hpw) : undefined,
          },
        },
      });
      addToast({ type: 'success', title: 'Matière assignée avec succès' });
      setSubjectId(''); setTeacherId(''); setCoef('1'); setHpw('');
      onSaved();
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('déjà') || msg.includes('already') || msg.includes('unique')) {
        addToast({ type: 'error', title: 'Cette matière est déjà assignée à cette classe' });
      } else {
        addToast({ type: 'error', title: 'Erreur', message: msg });
      }
    }
  };

  const handleRemoveCS = async (csId: string, nom: string) => {
    if (!confirm(`Retirer ${nom} de cette classe ?`)) return;
    try {
      await removeCS({ variables: { id: csId } });
      addToast({ type: 'success', title: `${nom} retiré de la classe` });
      onSaved();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full overflow-y-auto shadow-2xl"
           style={{ background: 'var(--bg-card)' }}>
        <div className="px-6 py-5 border-b border-[var(--bd)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--tx-primary)]">{cls.nom}</h2>
            <p className="text-sm text-[var(--tx-muted)]">{cls.level?.nom} · {cls.studentCount ?? 0} élèves</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--tx-muted)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Matières assignées */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--tx-secondary)] mb-3">Matières & Enseignants</h3>
            {!cls.classSubjects?.length ? (
              <p className="text-sm text-[var(--tx-muted)] py-4 text-center">Aucune matière assignée</p>
            ) : (
              <div className="space-y-2">
                {cls.classSubjects.map((cs: any) => (
                  <div key={cs.id} className="flex items-center justify-between p-3 rounded-lg"
                       style={{ background: 'var(--bg-subtle)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--tx-primary)] truncate">{cs.subject?.nom}</p>
                      <p className="text-xs text-[var(--tx-muted)] mt-0.5">
                        {cs.teacher?.profile?.prenom} {cs.teacher?.profile?.nom}
                        {' · '} Coef. {cs.coefficient}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveCS(cs.id, cs.subject?.nom)}
                      disabled={removing}
                      className="ml-3 p-1.5 rounded text-[var(--tx-muted)] hover:text-[var(--err)] hover:bg-[var(--err-bg)] transition-all flex-shrink-0"
                      title="Retirer cette matière"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigner une matière */}
          <FormSection icon={<Layers size={14} style={{ color: 'var(--accent)' }} />} title="Assigner une matière">
            <FormField label="Matière" required>
              <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Sélectionner…</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </FormField>
            <FormField label="Enseignant" required>
              <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Sélectionner…</option>
                {teachers.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.profile?.prenom} {t.profile?.nom}
                  </option>
                ))}
              </select>
            </FormField>
            <FormGrid>
              <FormField label="Coefficient">
                <input className="input" type="number" min="0.5" max="10" step="0.5"
                  value={coef} onChange={(e) => setCoef(e.target.value)} />
              </FormField>
              <FormField label="Heures / semaine">
                <input className="input" type="number" min="1" max="20"
                  value={hpw} onChange={(e) => setHpw(e.target.value)} />
              </FormField>
            </FormGrid>
            <button
              type="button"
              onClick={handleAssign}
              disabled={loading || !subjectId || !teacherId}
              className="btn-primary w-full justify-center"
            >
              {loading ? 'Assignation…' : 'Assigner la matière'}
            </button>
          </FormSection>
        </div>
      </div>
    </div>
  );
}

export default function AdminClassesPage() {
  const { addToast } = useToast();
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [selectedLevel, setLevel]     = useState('');
  const [activeClass, setClass]       = useState<any>(null);
  const [editClass, setEditClass]     = useState<any>(null);
  const [editName, setEditName]       = useState('');
  const [showNewClass, setNewClass]   = useState(false);
  const [newClassName, setName]       = useState('');
  const [newLevelId, setNewLevelId]   = useState('');
  const [showNewLevel, setNewLevel]   = useState(false);
  const [newLevelName, setLevelName]  = useState('');
  const [newLevelType, setLevelType]  = useState('COLLEGE');

  const { data: levelData }           = useQuery(LEVELS_BY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  const { data, refetch }             = useQuery(CLASSES_BY_SCHOOL_QUERY, {
    variables: { schoolId, levelId: selectedLevel || undefined }, skip: !schoolId,
  });
  const { data: subjectData }         = useQuery(SUBJECTS_BY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  const { data: teacherData }         = useQuery(SCHOOL_MEMBERS_QUERY, {
    variables: { schoolId, role: 'TEACHER', pagination: { page: 1, limit: 200 } },
    skip: !schoolId,
  });
  const { data: mySchoolData }        = useQuery(MY_SCHOOL_QUERY, { variables: { schoolId }, skip: !schoolId });
  // Année scolaire réellement configurée pour cet établissement (Admin > Paramètres),
  // plutôt qu'une valeur figée qui désynchronisait les classes créées d'une année sur l'autre.
  const currentAnneeScolaire          = mySchoolData?.mySchool?.anneeScolaire ?? '2024-2025';

  const [createClass,  { loading: creating }]      = useMutation(CREATE_CLASS_MUTATION);
  const [updateClass,  { loading: updating }]      = useMutation(UPDATE_CLASS_MUTATION);
  const [deleteClass]                              = useMutation(DELETE_CLASS_MUTATION);
  const [createLevel,  { loading: creatingLevel }] = useMutation(CREATE_LEVEL_MUTATION);

  const levels   = levelData?.levelsBySchool ?? [];
  const classes  = data?.classesBySchool ?? [];
  const subjects = subjectData?.subjectsBySchool ?? [];
  const teachers = teacherData?.schoolMembers?.data ?? [];

  const byLevel: Record<string, any[]> = {};
  for (const cls of classes) {
    const lid = cls.level?.id ?? 'other';
    if (!byLevel[lid]) byLevel[lid] = [];
    byLevel[lid].push(cls);
  }

  const handleCreateLevel = async () => {
    if (!newLevelName.trim()) return;
    try {
      await createLevel({ variables: { input: { schoolId, nom: newLevelName, type: newLevelType, ordre: levels.length + 1 } } });
      addToast({ type: 'success', title: `Niveau "${newLevelName}" créé` });
      setNewLevel(false); setLevelName(''); setLevelType('COLLEGE');
      refetch();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName || !newLevelId) return;
    try {
      await createClass({ variables: { input: { schoolId, levelId: newLevelId, nom: newClassName, anneeScolaire: currentAnneeScolaire } } });
      addToast({ type: 'success', title: `Classe "${newClassName}" créée` });
      setNewClass(false); setName(''); setNewLevelId('');
      refetch();
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('déjà') || msg.includes('unique') || msg.includes('existe')) {
        addToast({ type: 'error', title: 'Cette classe existe déjà' });
      } else {
        addToast({ type: 'error', title: 'Erreur', message: msg });
      }
    }
  };

  const handleUpdateClass = async () => {
    if (!editName.trim() || !editClass) return;
    try {
      await updateClass({ variables: { id: editClass.id, input: { nom: editName } } });
      addToast({ type: 'success', title: `Classe renommée en "${editName}"` });
      setEditClass(null);
      refetch();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
    }
  };

  const handleDeleteClass = async (cls: any) => {
    if (!confirm(`Supprimer la classe "${cls.nom}" ? Cette action est irréversible.`)) return;
    try {
      await deleteClass({ variables: { id: cls.id } });
      addToast({ type: 'success', title: `Classe "${cls.nom}" supprimée` });
      refetch();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur', message: parseGqlError(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Classes</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">{classes.length} classes configurées</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setNewLevel(true)} className="btn-secondary">
            <Plus size={15} /> Nouveau niveau
          </button>
          <button onClick={() => setNewClass(true)} className="btn-primary">
            <Plus size={15} /> Nouvelle classe
          </button>
        </div>
      </div>

      {/* Filtre niveaux */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setLevel('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
            ${!selectedLevel ? 'bg-[var(--accent)] text-[var(--accent-tx)] border-transparent' : 'border-[var(--bd)] text-[var(--tx-secondary)] hover:border-[var(--bd-strong)]'}`}
        >
          Tous
        </button>
        {levels.map((l: any) => (
          <button key={l.id} onClick={() => setLevel(l.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
              ${selectedLevel === l.id ? 'bg-[var(--accent)] text-[var(--accent-tx)] border-transparent' : 'border-[var(--bd)] text-[var(--tx-secondary)] hover:border-[var(--bd-strong)]'}`}
          >
            {l.nom}
          </button>
        ))}
      </div>

      {/* Classes par niveau */}
      {Object.entries(byLevel).map(([levelId, levelClasses]) => {
        const level = levels.find((l: any) => l.id === levelId);
        return (
          <div key={levelId}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-bold text-[var(--tx-secondary)]">{level?.nom ?? 'Autres'}</h2>
              <span className="badge badge-neutral text-xs">{LEVEL_TYPE_LABELS[level?.type] ?? level?.type}</span>
              <span className="text-xs text-[var(--tx-muted)]">{levelClasses.length} classe(s)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {levelClasses.map((cls: any) => (
                <div key={cls.id} className="card group relative">
                  {/* Actions flottantes */}
                  <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditClass(cls); setEditName(cls.nom); }}
                      className="p-1 rounded bg-[var(--bg-card)] border border-[var(--bd)] text-[var(--tx-muted)] hover:text-[var(--tx-primary)] hover:border-[var(--bd-strong)] transition-all shadow-sm"
                      title="Modifier"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls); }}
                      className="p-1 rounded bg-[var(--bg-card)] border border-[var(--bd)] text-[var(--tx-muted)] hover:text-[var(--err)] hover:border-[var(--err)] transition-all shadow-sm"
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="cursor-pointer" onClick={() => setClass(cls)}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                         style={{ background: 'var(--bg-subtle)' }}>
                      <BookOpen size={18} className="text-[var(--tx-secondary)]" />
                    </div>
                    <h3 className="font-bold text-[var(--tx-primary)] text-base pr-14">{cls.nom}</h3>
                    <p className="text-sm text-[var(--tx-muted)] mt-0.5">{cls.level?.nom}</p>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--bd)]">
                      <span className="flex items-center gap-1 text-xs text-[var(--tx-muted)]">
                        <Users size={12} /> {cls.studentCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[var(--tx-muted)]">
                        <Layers size={12} /> {cls.classSubjects?.length ?? 0} mat.
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {classes.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
          <BookOpen size={40} className="mb-3 opacity-40" />
          <p className="font-medium">Aucune classe configurée</p>
          <p className="text-sm mt-1">Commencez par créer des niveaux puis des classes</p>
        </div>
      )}

      {editClass && (
        <FormModal
          title="Modifier la classe"
          subtitle={editClass.level?.nom}
          icon={<Pencil size={18} style={{ color: 'var(--accent)' }} />}
          onClose={() => setEditClass(null)}
          onSubmit={handleUpdateClass}
          maxWidth={420}
          footer={
            <FormActions
              submitLabel="Enregistrer"
              loading={updating}
              onCancel={() => setEditClass(null)}
              disabled={!editName.trim()}
            />
          }
        >
          <FormSection icon={<BookOpen size={14} style={{ color: 'var(--accent)' }} />} title="Classe">
            <FormField label="Nom" required>
              <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex. 4ème A" autoFocus />
            </FormField>
          </FormSection>
        </FormModal>
      )}

      {showNewLevel && (
        <FormModal
          title="Nouveau niveau"
          subtitle="Ex. 6ème, CM2, Terminale — rattaché à un cycle."
          icon={<Layers size={18} style={{ color: 'var(--accent)' }} />}
          onClose={() => setNewLevel(false)}
          onSubmit={handleCreateLevel}
          maxWidth={460}
          footer={
            <FormActions
              submitLabel="Créer le niveau"
              loading={creatingLevel}
              onCancel={() => setNewLevel(false)}
              disabled={!newLevelName.trim()}
            />
          }
        >
          <FormSection icon={<Layers size={14} style={{ color: 'var(--accent)' }} />} title="Niveau">
            <FormField label="Nom" required>
              <input className="input" placeholder="Ex. 6ème, CM2, Terminale"
                value={newLevelName} onChange={(e) => setLevelName(e.target.value)} autoFocus />
            </FormField>
            <FormField label="Cycle">
              <select className="input" value={newLevelType} onChange={(e) => setLevelType(e.target.value)}>
                <option value="PRIMAIRE">Primaire</option>
                <option value="COLLEGE">Collège</option>
                <option value="LYCEE">Lycée</option>
              </select>
            </FormField>
          </FormSection>
        </FormModal>
      )}

      {showNewClass && (
        <FormModal
          title="Nouvelle classe"
          subtitle={`Année scolaire ${currentAnneeScolaire}`}
          icon={<BookOpen size={18} style={{ color: 'var(--accent)' }} />}
          onClose={() => setNewClass(false)}
          onSubmit={handleCreateClass}
          maxWidth={460}
          footer={
            <FormActions
              submitLabel="Créer la classe"
              loading={creating}
              onCancel={() => setNewClass(false)}
              disabled={!newClassName || !newLevelId}
            />
          }
        >
          <FormSection icon={<BookOpen size={14} style={{ color: 'var(--accent)' }} />} title="Classe">
            <FormField label="Niveau" required>
              <select className="input" value={newLevelId} onChange={(e) => setNewLevelId(e.target.value)}>
                <option value="">Sélectionner un niveau…</option>
                {levels.map((l: any) => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>
            </FormField>
            <FormField label="Nom" required>
              <input className="input" placeholder="Ex. 4ème A, CM1 1"
                value={newClassName} onChange={(e) => setName(e.target.value)} autoFocus />
            </FormField>
          </FormSection>
        </FormModal>
      )}

      {/* Drawer gestion classe */}
      {activeClass && (
        <ManageClassDrawer
          cls={classes.find((c: any) => c.id === activeClass.id) ?? activeClass}
          schoolId={schoolId}
          subjects={subjects}
          teachers={teachers}
          onClose={() => setClass(null)}
          onSaved={() => { refetch(); }}
        />
      )}
    </div>
  );
}
