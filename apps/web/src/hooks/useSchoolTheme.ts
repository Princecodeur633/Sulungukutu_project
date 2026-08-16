'use client';
import { useEffect } from 'react';
import { useLazyQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { tokenStorage } from '@/lib/apollo/client';

const SCHOOL_ACCENT_QUERY = gql`
  query SchoolAccent($schoolId: ID!) {
    mySchool(schoolId: $schoolId) {
      id accentColor nom logoUrl
    }
  }
`;

// Palette de couleurs prédéfinies pour les écoles
export const SCHOOL_PALETTES = [
  { name: 'Noir',      value: '#0c0c0c', dark: '#f5f5f5' },
  { name: 'Indigo',    value: '#4f46e5', dark: '#818cf8' },
  { name: 'Violet',    value: '#7c3aed', dark: '#a78bfa' },
  { name: 'Bleu',      value: '#2563eb', dark: '#60a5fa' },
  { name: 'Cyan',      value: '#0891b2', dark: '#22d3ee' },
  { name: 'Vert',      value: '#059669', dark: '#34d399' },
  { name: 'Orange',    value: '#ea580c', dark: '#fb923c' },
  { name: 'Rose',      value: '#e11d48', dark: '#fb7185' },
  { name: 'Bordeaux',  value: '#9f1239', dark: '#fda4af' },
  { name: 'Ardoise',   value: '#475569', dark: '#94a3b8' },
];

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r} ${g} ${b}`;
}

export function applySchoolAccent(accentColor: string | null | undefined) {
  if (!accentColor || typeof document === 'undefined') return;
  const isDark = document.documentElement.classList.contains('dark');
  
  // Trouver la palette correspondante
  const palette = SCHOOL_PALETTES.find(p => p.value === accentColor || p.dark === accentColor);
  const lightColor = palette?.value ?? accentColor;
  const darkColor  = palette?.dark  ?? accentColor;
  
  const color = isDark ? darkColor : lightColor;
  const txtColor = isDark ? '#0c0c0c' : '#ffffff';
  
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-tx', txtColor);
  document.documentElement.style.setProperty('--sidebar-brand-accent', color);
  
  // En dark mode, garder la sidebar noire
  if (!isDark) {
    // En light mode, la sidebar-brand-icon utilise la couleur accent
  }
}

export function useSchoolTheme() {
  const schoolId = typeof window !== 'undefined' ? tokenStorage.getSchoolId() : null;
  const [loadAccent, { data }] = useLazyQuery(SCHOOL_ACCENT_QUERY);

  useEffect(() => {
    if (schoolId) {
      loadAccent({ variables: { schoolId } });
    }
  }, [schoolId, loadAccent]);

  useEffect(() => {
    const color = data?.mySchool?.accentColor;
    if (color) {
      applySchoolAccent(color);
      // Sauvegarder pour la prochaine session
      localStorage.setItem('school_accent', color);
    }
  }, [data]);

  // Appliquer la couleur sauvegardée immédiatement au montage
  useEffect(() => {
    const saved = localStorage.getItem('school_accent');
    if (saved) applySchoolAccent(saved);
  }, []);

  return { school: data?.mySchool };
}
