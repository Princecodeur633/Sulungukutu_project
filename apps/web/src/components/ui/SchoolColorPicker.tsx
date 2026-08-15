'use client';
import React from 'react';
import { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { Check, Palette } from 'lucide-react';
import { SCHOOL_PALETTES, applySchoolAccent } from '@/hooks/useSchoolTheme';

const UPDATE_SCHOOL_ACCENT = gql`
  mutation UpdateSchoolAccent($input: UpdateSchoolInput!) {
    updateSchool(input: $input) {
      id accentColor
    }
  }
`;

interface Props { schoolId: string; currentColor?: string; onSaved?: () => void; }

export function SchoolColorPicker({ schoolId, currentColor, onSaved }: Props) {
  const [selected, setSelected] = useState(currentColor ?? '#0c0c0c');
  const [open, setOpen]         = useState(false);
  const [updateSchool, { loading }] = useMutation(UPDATE_SCHOOL_ACCENT);

  const handleSave = async (color: string) => {
    setSelected(color);
    applySchoolAccent(color);
    await updateSchool({ variables: { input: { accentColor: color } } });
    localStorage.setItem('school_accent', color);
    setOpen(false);
    onSaved?.();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 8,
          background: 'var(--bg-subtle)', border: '1px solid var(--bd)',
          cursor: 'pointer', fontSize: 13, color: 'var(--tx-secondary)',
          transition: 'all .15s',
        }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: selected, flexShrink: 0 }} />
        <Palette size={13} />
        <span>Couleur thème</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: 'var(--bg-card)', border: '1px solid var(--bd)',
          borderRadius: 12, padding: 12, zIndex: 100,
          boxShadow: 'var(--sh-lg)', width: 240,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Couleur d'accent
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {SCHOOL_PALETTES.map(p => (
              <button key={p.value} onClick={() => handleSave(p.value)} disabled={loading}
                title={p.name}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: p.value, border: selected === p.value ? '2px solid var(--tx-primary)' : '2px solid transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform .1s', transform: selected === p.value ? 'scale(1.1)' : 'scale(1)',
                }}>
                {selected === p.value && <Check size={14} color="#fff" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
