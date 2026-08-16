'use client';
import React from 'react';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import {
  MY_NOTIFICATIONS_QUERY,
  UNREAD_COUNTS_QUERY,
  MARK_ALL_NOTIFICATIONS_READ_MUTATION,
  NOTIFICATION_ADDED_SUBSCRIPTION,
  ME_QUERY,
} from '@/lib/graphql/queries';
import { usePathname } from 'next/navigation';
import {
  Bell, X, UserX, CreditCard, FileText, MessageSquare, Megaphone, AlertCircle,
} from 'lucide-react';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ABSENCE:  <UserX size={14} className="text-[var(--err)]" />,
  PAIEMENT: <CreditCard size={14} className="text-[var(--ok)]" />,
  BULLETIN: <FileText size={14} className="text-[var(--tx-secondary)]" />,
  MESSAGE:  <MessageSquare size={14} className="text-sky-500" />,
  ANNONCE:  <Megaphone size={14} className="text-[var(--warn)]" />,
  ALERTE:   <AlertCircle size={14} className="text-[var(--warn)]" />,
};

interface NotificationBellProps {
  schoolId: string;
}

export function NotificationBell({ schoolId }: NotificationBellProps) {
  const pathname = usePathname();
  const notifHref = pathname?.startsWith('/teacher') ? '/teacher/notifications'
    : pathname?.startsWith('/parent') ? '/parent/notifications'
    : pathname?.startsWith('/student') ? '/student/notifications'
    : '/admin/dashboard';
  const [open, setOpen]       = useState(false);
  const [pulse, setPulse]     = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const ref                   = useRef<HTMLDivElement>(null);

  // Profil courant → pour l'ID de subscription
  const { data: meData } = useQuery(ME_QUERY);
  const profileId = meData?.me?.id ?? '';

  // Compteur non-lus (polling 60s en fallback)
  const { data: countsData, refetch: refetchCounts } = useQuery(UNREAD_COUNTS_QUERY, {
    variables:    { schoolId },
    skip:         !schoolId,
    pollInterval: 60_000,
  });

  // Liste notifications (chargée à l'ouverture)
  const { data, refetch } = useQuery(MY_NOTIFICATIONS_QUERY, {
    variables: { pagination: { page: 1, limit: 10 } },
    skip:      !open,
  });

  // ── Subscription temps réel ──────────────────────────────────
  useSubscription(NOTIFICATION_ADDED_SUBSCRIPTION, {
    variables: { profileId },
    skip:      !profileId,
    onData: ({ data: subData }) => {
      const notif = subData?.data?.notificationAdded;
      if (!notif) return;

      // Pulse animation sur la cloche
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);

      // Notification navigateur si permission accordée
      if (typeof window !== 'undefined' && 'Notification' in window
          && Notification.permission === 'granted') {
        new Notification('Sulungukutu', {
          body: notif.titre,
          icon: '/favicon.ico',
        });
      }

      // Rafraîchir les compteurs + la liste si ouverte
      refetchCounts();
      if (open) refetch();
    },
  });

  const [markAll] = useMutation(MARK_ALL_NOTIFICATIONS_READ_MUTATION);

  const unread        = countsData?.unreadNotificationCount ?? 0;
  const notifications = data?.myNotifications?.data ?? [];

  // Demander permission notifs navigateur au premier montage
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window
        && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fermer en cliquant dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open) refetch();
  };

  const handleMarkAll = async () => {
    await markAll();
    refetch();
    refetchCounts();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className={`relative w-9 h-9 rounded-lg border border-[var(--bd)]
                    flex items-center justify-center transition-all
                    ${pulse ? 'bg-[var(--info-bg)] border-indigo-300' : 'hover:bg-[var(--bg-subtle)]'}`}
      >
        <Bell
          size={17}
          className={`transition-all ${pulse ? 'text-[var(--tx-primary)] animate-bounce' : 'text-[var(--tx-secondary)]'}`}
        />
        {mounted && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--err)] text-white
                           text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {mounted && open && (
        <div className="absolute right-0 top-11 w-80 bg-[var(--bg-card)] rounded-2xl shadow-xl
                        border border-[var(--bd)] z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--bd)]">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[var(--tx-primary)] text-sm">Notifications</h3>
              {unread > 0 && (
                <span className="bg-[var(--err)] text-white text-xs rounded-full w-5 h-5
                                 flex items-center justify-center font-bold">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-xs text-[var(--tx-primary)] hover:text-[var(--tx-primary)] font-medium"
                >
                  Tout lire
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-[var(--tx-muted)] hover:text-[var(--tx-secondary)]">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-[var(--tx-muted)]">
                <Bell size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune notification</p>
                <p className="text-xs mt-1 text-[var(--tx-muted)]">Les nouvelles arriveront en temps réel</p>
              </div>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50
                    ${!n.lu ? 'bg-[var(--info-bg)]/50' : 'hover:bg-[var(--bg-subtle)]'} transition-colors`}
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] flex items-center
                                  justify-center flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] ?? <Bell size={12} className="text-[var(--tx-muted)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold leading-tight
                      ${!n.lu ? 'text-[var(--tx-primary)]' : 'text-[var(--tx-secondary)]'}`}>
                      {n.titre}
                    </p>
                    <p className="text-xs text-[var(--tx-muted)] mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-[var(--tx-muted)] mt-0.5">
                      {new Date(n.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!n.lu && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 flex-shrink-0" />}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-[var(--bd)] text-center">
            <a
              href={notifHref}
              className="text-xs text-[var(--tx-primary)] hover:text-[var(--tx-primary)] font-medium"
              onClick={() => setOpen(false)}
            >
              Voir toutes les notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

