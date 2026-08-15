'use client';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import logoImg from '@/img/logo.png';
import {
  Bell, Building2, BookOpen, Calendar, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList,
  CreditCard, Download, FileText, GraduationCap, Home, Layers,
  LayoutDashboard, LogOut, Megaphone, Menu, MessageSquare, School,
  Search, Settings, Shield, TrendingUp, UserCircle, Users, X,
  Heart, Mail, UserCheck,
} from 'lucide-react';
import { tokenStorage, apolloClient } from '@/lib/apollo/client';
import dynamic from 'next/dynamic';
const NotificationBell = dynamic(
  () => import('@/components/notifications/NotificationBell').then(m => m.NotificationBell),
  { ssr: false }
);
import { PageTransition } from '@/components/ui/PageTransition';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { WorkspaceSwitcher } from '@/components/workspace-switcher/WorkspaceSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeProvider';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, BookOpen, GraduationCap, Users, Layers,
  Calendar, CreditCard, FileText, Megaphone, MessageSquare,
  ClipboardList, Download, TrendingUp, Home, UserCircle,
  Bell, Building2, ChevronRight, Settings, School, Shield, Search,
  Heart, Mail, UserCheck,
};

interface NavItem { label: string; href: string; icon: React.ElementType | string; badge?: number; external?: boolean; }
interface NavGroup { group?: string; items: NavItem[]; }
type AppShellProps = React.PropsWithChildren<{
  nav: NavGroup[]; role: string; profile?: any;
  schoolId?: string; schoolName?: string; memberships?: any[];
  msgBadge?: number; notifBadge?: number;
  showSearch?: boolean; onSearch?: (q: string) => void;
}>;

export function AppShell({
  children, nav, role, profile, schoolId = '', schoolName = '',
  memberships = [], showSearch = false, onSearch,
}: AppShellProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restaure la préférence de repli de la sidebar (bureau uniquement)
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') : null;
    if (saved === '1') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== 'undefined') localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const initials = [profile?.prenom?.[0], profile?.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  const SidebarContent = ({ collapsed: isCollapsed = false }: { collapsed?: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand + identité utilisateur */}
      <div style={{ padding: isCollapsed ? '16px 8px 10px' : '16px 14px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
          <div className="sidebar-brand-icon" style={{ background: "rgba(255,255,255,.18)", backdropFilter: "blur(8px)", flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image src={logoImg} alt="Sulungukutu" width={16} height={16} />
          </div>
          {!isCollapsed && (
            <span className="sidebar-brand-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {schoolName || 'Sulungukutu'}
            </span>
          )}
        </div>

        {/* Légende utilisateur — regroupée ici, en haut, avant le menu */}
        <Link href="/profile" className="sidebar-profile-link" style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
          <div className="sidebar-avatar" style={{ flexShrink: 0 }}>{initials}</div>
          {!isCollapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="sidebar-profile-name">{profile?.prenom} {profile?.nom}</p>
              <p className="sidebar-profile-sub">{role}</p>
            </div>
          )}
        </Link>
      </div>

      <div className="sidebar-divider" />

      {/* Nav */}
      <nav style={{ flex: 1, padding: isCollapsed ? '6px 6px' : '6px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {nav.map((section, si) => (
          <div key={si} style={{ marginBottom: 6 }}>
            {section.group && !isCollapsed && <p className="sidebar-group-label">{section.group}</p>}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon   = typeof item.icon === 'string' ? (ICON_MAP[item.icon] ?? LayoutDashboard) : item.icon;
              const cnt    = item.badge ?? 0;
              return item.external ? (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                  title={isCollapsed ? item.label : undefined}
                  className="sidebar-link" style={isCollapsed ? { justifyContent: 'center' } : undefined}>
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  {!isCollapsed && (
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  )}
                </a>
              ) : (
                <Link key={item.href} href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={active ? 'sidebar-link-active' : 'sidebar-link'} style={isCollapsed ? { justifyContent: 'center' } : undefined}>
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  {!isCollapsed && (
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  )}
                  {cnt > 0 && !isCollapsed && (
                    <span className="nav-badge">{cnt > 99 ? '99+' : cnt}</span>
                  )}
                  {cnt > 0 && isCollapsed && (
                    <span className="nav-badge-dot" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-divider" />

      {/* Repli/dépli + déconnexion */}
      <div style={{ padding: '8px 8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }} className="sidebar-bottom-safe">
        <button
          onClick={toggleCollapsed}
          className="sidebar-collapse-btn hidden lg:flex"
          title={isCollapsed ? 'Déplier le menu' : 'Replier le menu'}
          style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}
        >
          {isCollapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          {!isCollapsed && <span>Replier</span>}
        </button>
        <button
          onClick={async () => { await apolloClient.clearStore(); tokenStorage.clear(); router.push('/auth/login'); }}
          className="sidebar-logout-btn"
          title={isCollapsed ? 'Déconnexion' : undefined}
          style={isCollapsed ? { justifyContent: 'center' } : undefined}
        >
          <LogOut size={14} />
          {!isCollapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg-app)', padding: 10, gap: 10, boxSizing: 'border-box' }}>

      {/* Sidebar desktop — panneau flottant, arrondi sur les 4 côtés */}
      <aside
        className="hidden lg:block sidebar-root"
        style={{
          width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'width .2s cubic-bezier(.16,1,.3,1)',
          backgroundImage: 'linear-gradient(180deg, var(--bg-sidebar-grad-start) 0%, var(--bg-sidebar-grad-end) 100%)',
        }}>
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Overlay mobile */}
      {open && (
        <div
          className="lg:hidden"
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer mobile — flush à gauche, arrondi côté droit + haut/bas */}
      <aside
        className="lg:hidden"
        style={{
          position: 'fixed', left: 10, top: 10, height: 'calc(100dvh - 20px)', zIndex: 50,
          width: 268,
          borderRadius: 'var(--r-shell)',
          backgroundImage: 'linear-gradient(180deg, var(--bg-sidebar-grad-start) 0%, var(--bg-sidebar-grad-end) 100%)',
          transform: open ? 'translateX(0)' : 'translateX(-115%)',
          transition: 'transform .3s cubic-bezier(.16,1,.3,1)',
          boxShadow: open ? 'var(--sh-xl)' : 'none',
          overflowY: 'auto',
        }}>
        <button onClick={() => setOpen(false)} className="sidebar-close-btn">
          <X size={15} />
        </button>
        <SidebarContent />
      </aside>

      {/* Colonne principale — un seul panneau flottant arrondi (topbar + contenu) */}
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minWidth: 0,
          borderRadius: 'var(--r-shell)',
          border: '1px solid var(--bd)',
          boxShadow: 'var(--sh-sm)',
        }}>

        {/* Topbar */}
        <header
          className="topbar-inner"
          style={{
            height: 'var(--topbar-h)',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--bd)',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 20px', flexShrink: 0,
          }}>
          {/* Hamburger — mobile only */}
          <button
            className="topbar-menu-btn lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menu"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Menu size={18} />
          </button>

          {/* School name on mobile (when sidebar hidden) */}
          <span
            className="lg:hidden"
            style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {schoolName || 'Sulungukutu'}
          </span>

          {showSearch && <div className="hidden sm:block flex-1"><GlobalSearch /></div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
            <ThemeToggle />
            {memberships.length > 1 && (
              <div className="hidden sm:block">
                <WorkspaceSwitcher currentSchoolId={schoolId} currentSchoolName={schoolName} memberships={memberships} />
              </div>
            )}
            {schoolId && <NotificationBell schoolId={schoolId} />}
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 'clamp(12px, 2.5vw, 24px)',
            background: 'var(--bg-app)',
          }}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}

