'use client';
import React from 'react';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

interface Props {
  sidebar: React.ReactNode;
  topbar:  React.ReactNode;
  children: React.ReactNode;
  bgColor?: string;
}

/**
 * Wrapper universel qui ajoute le support mobile (hamburger + drawer)
 * à n'importe quelle sidebar.
 */
export function MobileSidebarWrapper({ sidebar, topbar, children, bgColor = '#1e1b4b' }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fermer au changement de route
  useEffect(() => { setOpen(false); }, [pathname]);

  // Bloquer le scroll du body
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-subtle)]">

      {/* ── Sidebar desktop ─────────────────────────────────── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-60 flex-col z-40"
        style={{ background: bgColor }}>
        {sidebar}
      </aside>

      {/* ── Overlay mobile ──────────────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)} />
      )}

      {/* ── Drawer mobile ───────────────────────────────────── */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-full w-72 flex flex-col z-50
                    transition-transform duration-300 ease-in-out
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: bgColor }}
      >
        <button onClick={() => setOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-[var(--bg-card)]/10 text-white hover:bg-[var(--bg-card)]/20 z-10">
          <X size={18} />
        </button>
        {sidebar}
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:ml-60 overflow-hidden">

        {/* Topbar avec hamburger */}
        <header className="h-14 flex items-center gap-3 px-4 lg:px-6 bg-[var(--bg-card)] border-b
                           border-[var(--bd)] flex-shrink-0 shadow-sm">
          <button onClick={() => setOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-[var(--bg-subtle)] text-[var(--tx-secondary)] transition-colors flex-shrink-0">
            <Menu size={20} />
          </button>
          <div className="flex-1 flex items-center">
            {topbar}
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
