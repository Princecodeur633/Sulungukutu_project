'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import Link from 'next/link';
import {
  Bell, CheckCheck, Trash2, Filter, UserX, CreditCard,
  FileText, MessageSquare, Megaphone, AlertCircle, Info,
  ArrowRight,
} from 'lucide-react';
import {
  MY_NOTIFICATIONS_QUERY,
  MARK_NOTIFICATION_READ_MUTATION,
  MARK_ALL_NOTIFICATIONS_READ_MUTATION,
  DELETE_NOTIFICATION_MUTATION,
} from '@/lib/graphql/queries';

// ── Config par type de notification ──────────────────────────
const TYPE_CONFIG: Record<string, {
  label: string; icon: any; bg: string; text: string; border: string;
}> = {
  ABSENCE:  { label: 'Absence',   icon: UserX,         bg: 'bg-[var(--err-bg)]',      text: 'text-[var(--err)]',     border: 'border-[var(--bd)]'     },
  PAIEMENT: { label: 'Paiement',  icon: CreditCard,    bg: 'bg-[var(--ok-bg)]',  text: 'text-[var(--ok)]', border: 'border-[var(--bd)]' },
  BULLETIN: { label: 'Bulletin',  icon: FileText,      bg: 'bg-[var(--info-bg)]',   text: 'text-[var(--tx-primary)]',  border: 'border-[var(--bd)]'  },
  MESSAGE:  { label: 'Message',   icon: MessageSquare, bg: 'bg-[var(--info-bg)]',      text: 'text-[var(--info)]',     border: 'border-[var(--bd)]'     },
  ANNONCE:  { label: 'Annonce',   icon: Megaphone,     bg: 'bg-[var(--warn-bg)]',    text: 'text-[var(--warn)]',   border: 'border-[var(--bd)]'   },
  ALERTE:   { label: 'Alerte',    icon: AlertCircle,   bg: 'bg-[var(--warn-bg)]',   text: 'text-[var(--warn)]',  border: 'border-orange-100'  },
  SYSTEME:  { label: 'Système',   icon: Info,          bg: 'bg-[var(--bg-subtle)]',    text: 'text-[var(--tx-secondary)]',   border: 'border-[var(--bd)]'   },
};

// ── Liens contextuels par rôle et type ────────────────────────
function getContextLink(type: string, role: 'parent' | 'student' | 'teacher'): string | null {
  const links: Record<string, Record<string, string | null>> = {
    parent: {
      BULLETIN: '/parent/children',
      ABSENCE:  '/parent/children',
      PAIEMENT: '/parent/dashboard',
      MESSAGE:  '/parent/messages',
      ANNONCE:  '/parent/dashboard',
    },
    student: {
      BULLETIN: '/student/bulletins',
      ABSENCE:  '/student/attendance',
      MESSAGE:  '/student/messages',
      ANNONCE:  '/student/dashboard',
      PAIEMENT: '/student/dashboard',
    },
    teacher: {
      MESSAGE:  '/teacher/messages',
      ANNONCE:  '/teacher/dashboard',
      ABSENCE:  '/teacher/classes',
    },
  };
  return links[role]?.[type] ?? null;
}

const FILTER_LABELS = ['Toutes', 'Non lues', 'ABSENCE', 'MESSAGE', 'BULLETIN', 'PAIEMENT', 'ANNONCE'] as const;
type FilterKey = typeof FILTER_LABELS[number];

// ── Composant principal ───────────────────────────────────────
interface Props {
  role: 'parent' | 'student' | 'teacher';
}

export function NotificationList({ role }: Props) {
  const [filter, setFilter]   = useState<FilterKey>('Toutes');
  const [page,   setPage]     = useState(1);
  const LIMIT = 20;

  const { data, loading, refetch } = useQuery(MY_NOTIFICATIONS_QUERY, {
    variables: { pagination: { page, limit: LIMIT } },
  });

  const [markRead]    = useMutation(MARK_NOTIFICATION_READ_MUTATION);
  const [markAll]     = useMutation(MARK_ALL_NOTIFICATIONS_READ_MUTATION);
  const [deleteNotif] = useMutation(DELETE_NOTIFICATION_MUTATION);

  const allNotifs = data?.myNotifications?.data ?? [];
  const pageInfo  = data?.myNotifications?.pageInfo;
  const unread    = allNotifs.filter((n: any) => !n.lu).length;

  const filtered = allNotifs.filter((n: any) => {
    if (filter === 'Non lues') return !n.lu;
    if (filter === 'Toutes')   return true;
    return n.type === filter;
  });

  const handleMarkRead = async (id: string) => {
    await markRead({ variables: { id } });
    refetch();
  };

  const handleMarkAll = async () => {
    await markAll();
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette notification ?')) return;
    await deleteNotif({ variables: { id } });
    refetch();
  };

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            {pageInfo?.totalCount ?? 0} au total
            {unread > 0 && (
              <span className="ml-2 text-[var(--tx-primary)] font-semibold">
                · {unread} non lue{unread > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={handleMarkAll} className="btn-secondary text-sm gap-1.5">
            <CheckCheck size={15} /> Tout marquer lu
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter size={13} className="text-[var(--tx-muted)] flex-shrink-0" />
        {FILTER_LABELS.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
              ${filter === f
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-[var(--bg-card)] border-[var(--bd)] text-[var(--tx-secondary)] hover:border-indigo-300 hover:text-[var(--tx-primary)]'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <Bell size={44} className="empty-state-icon" />
          <p className="font-semibold text-[var(--tx-muted)]">
            {filter === 'Toutes' ? 'Aucune notification' : `Aucune notification "${filter}"`}
          </p>
          {filter !== 'Toutes' && (
            <button onClick={() => setFilter('Toutes')} className="btn-ghost mt-2 text-xs">
              Voir toutes
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n: any) => {
            const cfg     = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.SYSTEME;
            const Icon    = cfg.icon;
            const ctxLink = getContextLink(n.type, role);

            return (
              <div
                key={n.id}
                className={`group bg-[var(--bg-card)] rounded-2xl border p-4 flex items-start gap-3.5
                  transition-all duration-150
                  ${!n.lu
                    ? `border-l-4 border-l-indigo-400 ${cfg.border} shadow-sm`
                    : 'border-[var(--bd)] hover:border-[var(--bd)] hover:shadow-sm'}`}
              >
                {/* Icône type */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                                flex-shrink-0 ${cfg.bg}`}>
                  <Icon size={18} className={cfg.text} />
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 justify-between">
                    <p className={`text-sm font-semibold leading-snug
                      ${!n.lu ? 'text-[var(--tx-primary)]' : 'text-[var(--tx-secondary)]'}`}>
                      {n.titre}
                    </p>
                    {!n.lu && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0 mt-1" />
                    )}
                  </div>

                  <p className="text-sm text-[var(--tx-muted)] mt-0.5 leading-relaxed">{n.message}</p>

                  <div className="flex items-center gap-3 mt-2">
                    {/* Badge type */}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                    {/* Date */}
                    <span className="text-xs text-[var(--tx-muted)]">
                      {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {/* Lien contextuel */}
                    {ctxLink && (
                      <Link
                        href={ctxLink}
                        className={`text-xs font-semibold flex items-center gap-0.5
                                    ${cfg.text} hover:underline`}
                      >
                        Voir <ArrowRight size={11} />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Actions (visibles au hover) */}
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {!n.lu && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      title="Marquer comme lu"
                      className="p-1.5 rounded-lg hover:bg-[var(--ok-bg)] text-[var(--tx-muted)] hover:text-[var(--ok)] transition-colors"
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    title="Supprimer"
                    className="p-1.5 rounded-lg hover:bg-[var(--err-bg)] text-[var(--tx-muted)] hover:text-[var(--err)] transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pageInfo && pageInfo.totalPages > 1 && (
        <div className="card p-3 flex items-center justify-between">
          <p className="text-sm text-[var(--tx-muted)]">
            Page {page} / {pageInfo.totalPages}
            <span className="text-[var(--tx-muted)] ml-1">({pageInfo.totalCount} total)</span>
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-40"
            >← Préc.</button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pageInfo.hasNextPage}
              className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-40"
            >Suiv. →</button>
          </div>
        </div>
      )}
    </div>
  );
}
