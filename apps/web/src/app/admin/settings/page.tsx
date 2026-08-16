'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';
import { SchoolColorPicker } from '@/components/ui/SchoolColorPicker';
import { useToast } from '@/components/ui/Toast';
import { School, Palette, Save, Building2 } from 'lucide-react';

const SCHOOL_SETTINGS_QUERY = gql`
  query SchoolSettings($id: ID!) {
    mySchool(schoolId: $id) {
      id nom code adresse telephone logoUrl anneeScolaire accentColor
    }
  }
`;

const UPDATE_SCHOOL_MUTATION = gql`
  mutation UpdateSchoolSettings($input: UpdateSchoolInput!) {
    updateSchool(input: $input) {
      id nom adresse telephone anneeScolaire accentColor
    }
  }
`;

export default function AdminSettings() {
  const schoolId   = tokenStorage.getSchoolId() ?? '';
  const { addToast } = useToast();
  const { data, refetch } = useQuery(SCHOOL_SETTINGS_QUERY, { variables: { id: schoolId }, skip: !schoolId });
  const school = data?.mySchool;

  const [form, setForm] = useState({ nom: '', adresse: '', telephone: '', anneeScolaire: '' });
  const [initialized, setInit] = useState(false);

  useEffect(() => {
    if (school && !initialized) {
      setForm({ nom: school.nom, adresse: school.adresse ?? '', telephone: school.telephone ?? '', anneeScolaire: school.anneeScolaire });
      setInit(true);
    }
  }, [school, initialized]);

  const [updateSchool, { loading }] = useMutation(UPDATE_SCHOOL_MUTATION);

  const handleSave = async () => {
    try {
      await updateSchool({ variables: { input: form } });
      addToast({ type: 'success', title: 'Paramètres sauvegardés' });
      refetch();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur', message: err.message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
      <div>
        <h1 className="page-title">Paramètres de l'école</h1>
        <p className="page-subtitle">Configurez les informations et l'apparence de votre établissement</p>
      </div>

      {/* Infos générales */}
      <div className="card">
        <div className="section-title"><Building2 size={15} style={{ color: 'var(--tx-muted)' }} />Informations générales</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Nom de l'école *</label>
              <input className="input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Lycée Victor Hugo" />
            </div>
            <div>
              <label className="label">Année scolaire *</label>
              <input className="input" value={form.anneeScolaire} onChange={e => setForm(f => ({ ...f, anneeScolaire: e.target.value }))} placeholder="2024-2025" />
            </div>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} placeholder="Adresse complète" />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="+242 XX XXX XXXX" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={loading} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Save size={14} /> {loading ? 'Sauvegarde…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>

      {/* Apparence */}
      <div className="card">
        <div className="section-title"><Palette size={15} style={{ color: 'var(--tx-muted)' }} />Apparence & Thème</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-primary)', marginBottom: 4 }}>Couleur d'accent</p>
            <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginBottom: 12 }}>
              Personnalisez la couleur principale de votre interface. Elle s'applique à tous les utilisateurs de votre école.
            </p>
            {schoolId && (
              <SchoolColorPicker
                schoolId={schoolId}
                currentColor={school?.accentColor}
                onSaved={() => { addToast({ type: 'success', title: 'Couleur mise à jour' }); refetch(); }}
              />
            )}
          </div>
          <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 10, border: '1px solid var(--bd)' }}>
            <p style={{ fontSize: 12, color: 'var(--tx-muted)' }}>
              💡 La couleur sélectionnée est appliquée immédiatement. En mode sombre, une version claire est automatiquement utilisée.
            </p>
          </div>
        </div>
      </div>

      {/* Info école */}
      {school && (
        <div className="card" style={{ background: 'var(--bg-subtle)' }}>
          <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginBottom: 4 }}>Code établissement</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx-primary)', letterSpacing: '.05em' }}>{school.code}</p>
          <p style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 4 }}>Partagez ce code avec vos utilisateurs pour qu'ils rejoignent votre école</p>
        </div>
      )}
    </div>
  );
}
