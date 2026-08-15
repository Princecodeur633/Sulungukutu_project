'use client';
import React from 'react';
import { useState, useEffect } from 'react';
import { Plus, X, GraduationCap, Users, TrendingUp, Megaphone, FileText, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface FABAction {
  label: string;
  href: string;
  icon: React.ElementType;
  color: string;
}

const ACTION_MAP: Record<string, FABAction[]> = {
  admin: [
    { label: 'Nouvel élève',       href: '/admin/students?new=1',      icon: GraduationCap, color: '#6366f1' },
    { label: 'Inviter enseignant', href: '/admin/teachers?new=1',      icon: Users,         color: '#8b5cf6' },
    { label: 'Saisir notes',       href: '/admin/grades',              icon: TrendingUp,    color: '#0ea5e9' },
    { label: 'Annonce',            href: '/admin/announcements?new=1', icon: Megaphone,     color: '#f59e0b' },
    { label: 'Générer bulletins',  href: '/admin/bulletins',           icon: FileText,      color: '#10b981' },
    { label: 'Paiements',          href: '/admin/payments',            icon: CreditCard,    color: '#ef4444' },
  ],
  teacher: [
    { label: 'Saisir notes',    href: '/teacher/classes', icon: TrendingUp,  color: '#6366f1' },
    { label: 'Mes bulletins',   href: '/teacher/bulletins', icon: FileText,  color: '#10b981' },
  ],
};

export function FloatingActions({ role }: { role: string }) {
  const [open, setOpen]   = useState(false);
  const [visible, setVis] = useState(false);
  const pathname          = usePathname();
  const actions           = ACTION_MAP[role] ?? [];

  // Masquer sur mobile quand keyboard est ouvert
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const t = setTimeout(() => setVis(true), 400);
    return () => clearTimeout(t);
  }, []);

  if (!actions.length || !visible) return null;

  return (
    <div className="fab-container" style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 200,
      display: 'flex', flexDirection: 'column-reverse', alignItems: 'flex-end', gap: 10,
    }}>
      {/* Action items */}
      {open && actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <Link key={action.href} href={action.href}
            onClick={() => setOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-card)', border: '1px solid var(--bd)',
              borderRadius: 28, padding: '8px 14px 8px 10px',
              boxShadow: 'var(--sh-lg)', textDecoration: 'none',
              animation: `fabItemIn 0.2s ease ${i * 0.04}s both`,
              whiteSpace: 'nowrap',
            }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: action.color + '18', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={14} style={{ color: action.color }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-primary)' }}>
              {action.label}
            </span>
          </Link>
        );
      })}

      {/* Main FAB button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent)', border: 'none',
          color: 'var(--accent-tx)', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s cubic-bezier(.34,1.56,.64,1)',
          transform: open ? 'rotate(45deg) scale(1.08)' : 'rotate(0deg) scale(1)',
        }}>
        {open ? <X size={20} /> : <Plus size={20} />}
      </button>
    </div>
  );
}
