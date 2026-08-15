'use client';
import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('edu_theme') as Theme | null;
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const t = stored ?? sys;
    setTheme(t);
    t === 'dark' ? document.documentElement.classList.add('dark')
                 : document.documentElement.classList.remove('dark');
    setReady(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    next === 'dark' ? document.documentElement.classList.add('dark')
                    : document.documentElement.classList.remove('dark');
    localStorage.setItem('edu_theme', next);
  };

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      {/* Anti-flash: cache body jusqu'au montage */}
      <style>{`body { visibility: ${ready ? 'visible' : 'hidden'}; }`}</style>
      {children}
    </ThemeCtx.Provider>
  );
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-lg transition-all focus-ring ${className}`}
      style={{ color: 'var(--tx-muted)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--tx-primary)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--tx-muted)'; }}
      title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
      aria-label="Basculer le thème"
    >
      {theme === 'dark' ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
    </button>
  );
}
