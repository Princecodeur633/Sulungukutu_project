'use client';
import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLazyQuery } from '@apollo/client';
import { GLOBAL_SEARCH_QUERY } from '@/lib/graphql/queries';
import { Search, GraduationCap, Users, BookOpen, Layers, X, ArrowRight, Command } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/lib/apollo/client';

const TYPE_ICONS: Record<string, React.ElementType> = {
  student: GraduationCap,
  teacher: Users,
  class:   BookOpen,
  subject: Layers,
};
const TYPE_COLORS: Record<string, string> = {
  student: '#6366f1',
  teacher: '#8b5cf6',
  class:   '#0ea5e9',
  subject: '#10b981',
};
const TYPE_LABELS: Record<string, string> = {
  student: 'Élève',
  teacher: 'Enseignant',
  class:   'Classe',
  subject: 'Matière',
};

export function GlobalSearch() {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef            = useRef<HTMLInputElement>(null);
  const router              = useRouter();
  const schoolId            = tokenStorage.getSchoolId() ?? '';

  const [search, { data, loading }] = useLazyQuery(GLOBAL_SEARCH_QUERY, {
    fetchPolicy: 'network-only',
  });

  const results = data?.globalSearch ?? [];

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  // Debounce search
  useEffect(() => {
    if (!query || query.length < 2 || !schoolId) return;
    const t = setTimeout(() => {
      search({ variables: { schoolId, query } });
    }, 200);
    return () => clearTimeout(t);
  }, [query, schoolId, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && results[cursor]) {
      router.push(results[cursor].href);
      setOpen(false);
    }
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="global-search-trigger"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 8,
        background: 'var(--bg-subtle)', border: '1px solid var(--bd)',
        color: 'var(--tx-muted)', fontSize: 13, cursor: 'pointer',
        transition: 'all .15s', width: 200,
      }}>
      <Search size={13} />
      <span style={{ flex: 1, textAlign: 'left' }}>Rechercher...</span>
      <kbd style={{
        display: 'flex', alignItems: 'center', gap: 2,
        fontSize: 10, fontWeight: 600,
        background: 'var(--bg-card)', border: '1px solid var(--bd)',
        borderRadius: 4, padding: '1px 4px', color: 'var(--tx-muted)',
      }}>
        <Command size={9} /> K
      </kbd>
    </button>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
          animation: 'fadeIn .12s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '15%', left: '50%',
        transform: 'translateX(-50%)', zIndex: 999,
        width: '90%', maxWidth: 560,
        background: 'var(--bg-card)', borderRadius: 16,
        border: '1px solid var(--bd)', boxShadow: 'var(--sh-xl)',
        animation: 'searchIn .15s cubic-bezier(.16,1,.3,1)',
        overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderBottom: '1px solid var(--bd)',
        }}>
          <Search size={17} style={{ color: 'var(--tx-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un élève, enseignant, classe, matière..."
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 15, color: 'var(--tx-primary)', outline: 'none',
            }}
          />
          {loading && <div className="spinner" style={{ width: 16, height: 16 }} />}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-muted)', padding: 2 }}>
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        {query.length >= 2 && (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {results.length === 0 && !loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--tx-muted)', fontSize: 14 }}>
                Aucun résultat pour « {query} »
              </div>
            ) : (
              <div style={{ padding: '6px 8px' }}>
                {results.map((r: any, i: number) => {
                  const Icon  = TYPE_ICONS[r.type] ?? Search;
                  const color = TYPE_COLORS[r.type] ?? 'var(--tx-secondary)';
                  const label = TYPE_LABELS[r.type] ?? r.type;
                  const active = i === cursor;
                  return (
                    <button key={r.id}
                      onClick={() => { router.push(r.href); setOpen(false); }}
                      onMouseEnter={() => setCursor(i)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 10, border: 'none',
                        background: active ? 'var(--bg-subtle)' : 'transparent',
                        cursor: 'pointer', textAlign: 'left', transition: 'background .1s',
                      }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: color + '18',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.label}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--tx-muted)' }}>{r.sublabel}</p>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px',
                        borderRadius: 5, background: color + '18', color,
                      }}>{label}</span>
                      {active && <ArrowRight size={14} style={{ color: 'var(--tx-muted)', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state hint */}
        {query.length < 2 && (
          <div style={{ padding: '20px 16px' }}>
            <p style={{ fontSize: 12, color: 'var(--tx-muted)', marginBottom: 12 }}>Suggestions</p>
            {['élève', 'enseignant', 'classe', 'matière'].map(hint => (
              <button key={hint} onClick={() => setQuery(hint)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  marginRight: 8, marginBottom: 8,
                  padding: '5px 10px', borderRadius: 20,
                  background: 'var(--bg-subtle)', border: '1px solid var(--bd)',
                  fontSize: 12, color: 'var(--tx-secondary)', cursor: 'pointer',
                }}>
                <Search size={10} /> {hint}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 12, padding: '8px 16px',
          borderTop: '1px solid var(--bd)', fontSize: 11, color: 'var(--tx-muted)',
        }}>
          <span>↑↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>Esc fermer</span>
        </div>
      </div>
    </>
  );
}
