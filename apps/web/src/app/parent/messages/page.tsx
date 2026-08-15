'use client';
import { useToast } from '@/components/ui/Toast';
import { parseGqlError } from '@/lib/errorUtils';

import { useState } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { MARK_MESSAGE_READ_MUTATION, MY_MESSAGES_QUERY, SEARCH_MEMBERS_QUERY, SEND_MESSAGE_MUTATION, MESSAGE_RECEIVED_SUBSCRIPTION } from '@/lib/graphql/queries';
import { tokenStorage } from '@/lib/apollo/client';
import { MessageSquare, Send, Search, Plus } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', TEACHER: 'Enseignant', PARENT: 'Parent', STUDENT: 'Élève',
};

function ComposeModal({
  schoolId, members, currentMembershipId, onClose, onSent,
}: {
  schoolId: string; members: any[]; currentMembershipId: string;
  onClose: () => void; onSent: () => void;
}) {
  const [receiverId, setReceiver] = useState('');
  const [sujet, setSujet]         = useState('');
  const [contenu, setContenu]     = useState('');
  const [sendMessage, { loading }] = useMutation(SEND_MESSAGE_MUTATION);

  const { addToast } = useToast();
  const handleSend = async () => {
    if (!receiverId || !sujet || !contenu) {
      addToast({ type: 'warning', title: 'Champs manquants', message: 'Destinataire, sujet et contenu sont requis.' });
      return;
    }
    try {
      await sendMessage({
        variables: { input: { schoolId, receiverId, sujet, contenu } },
      });
      addToast({ type: 'success', title: 'Message envoyé' });
      onSent(); onClose();
    } catch(err: any) {
      addToast({ type: 'error', title: 'Erreur envoi', message: parseGqlError(err) });
    }
  };

  const others = members.filter((m) => m.id !== currentMembershipId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-[var(--bd)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--tx-primary)]">Nouveau message</h2>
          <button onClick={onClose} className="text-[var(--tx-muted)] hover:text-[var(--tx-secondary)] text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Destinataire *</label>
            <select className="input" value={receiverId} onChange={(e) => setReceiver(e.target.value)}>
              <option value="">Sélectionner...</option>
              {others.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.profile?.prenom} {m.profile?.nom} — {ROLE_LABELS[m.role] ?? m.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Sujet *</label>
            <input className="input" value={sujet} onChange={(e) => setSujet(e.target.value)}
              placeholder="Objet du message..." />
          </div>
          <div>
            <label className="label">Message *</label>
            <textarea
              className="input resize-none"
              rows={5}
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder="Écrivez votre message..."
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[var(--bd)] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button
            onClick={handleSend}
            disabled={loading || !receiverId || !sujet || !contenu}
            className="btn-primary"
          >
            <Send size={15} />
            {loading ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';
  const [search, setSearch]       = useState('');
  const [showCompose, setCompose] = useState(false);
  const [page, setPage]           = useState(1);

  const { data, loading, refetch } = useQuery(MY_MESSAGES_QUERY, {
    variables: { schoolId, pagination: { page, limit: 20 } },
    skip: !schoolId,
  });
  const { data: membersData } = useQuery(SEARCH_MEMBERS_QUERY, {
    variables: { schoolId, query: '' }, skip: !schoolId,
  });
  const [markRead] = useMutation(MARK_MESSAGE_READ_MUTATION);

  // ── Temps réel : nouveau message reçu ──────────────────────
  // Le backend expose déjà cet abonnement mais rien ne l'écoutait côté
  // client — les nouveaux messages n'apparaissaient qu'au rechargement.
  const membershipId = tokenStorage.getMembershipId() ?? '';
  useSubscription(MESSAGE_RECEIVED_SUBSCRIPTION, {
    variables: { schoolId, membershipId },
    skip: !schoolId || !membershipId,
    onData: () => refetch(),
  });

  const messages = data?.myMessages?.data ?? [];
  const members  = membersData?.searchMembers ?? [];

  const filtered = search
    ? messages.filter((m: any) =>
        m.sujet.toLowerCase().includes(search.toLowerCase()) ||
        `${m.sender?.profile?.prenom} ${m.sender?.profile?.nom}`.toLowerCase().includes(search.toLowerCase())
      )
    : messages;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tx-primary)]">Messages</h1>
          <p className="text-[var(--tx-muted)] text-sm mt-0.5">
            {messages.filter((m: any) => !m.lu).length} non lu(s)
          </p>
        </div>
        <button onClick={() => setCompose(true)} className="btn-primary">
          <Plus size={15} /> Nouveau message
        </button>
      </div>

      {/* Recherche */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-muted)]" />
          <input
            className="input pl-9 py-1.5 text-sm"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Liste */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--tx-muted)]">
            <MessageSquare size={40} className="mb-3 opacity-40" />
            <p className="font-medium">Aucun message</p>
          </div>
        ) : (
          filtered.map((msg: any, i: number) => {
            const isUnread  = !msg.lu;
            const isSent    = msg.sender?.id === undefined; // approximate
            const other     = msg.sender;
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors
                  ${i < filtered.length - 1 ? 'border-b border-[var(--bd)]' : ''}
                  ${isUnread ? 'bg-[var(--info-bg)]/40' : 'hover:bg-[var(--bg-subtle)]'}`}
                onClick={async () => {
                  if (isUnread) {
                    await markRead({ variables: { id: msg.id } });
                    refetch();
                  }
                }}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[var(--info-bg)] flex items-center
                                justify-center text-[var(--tx-primary)] font-bold flex-shrink-0">
                  {other?.profile?.prenom?.[0] ?? '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className={`text-sm ${isUnread ? 'font-bold text-[var(--tx-primary)]' : 'font-medium text-[var(--tx-secondary)]'}`}>
                      {other?.profile?.prenom} {other?.profile?.nom}
                    </p>
                    <span className="text-xs text-[var(--tx-muted)] flex-shrink-0">
                      {new Date(msg.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className={`text-sm ${isUnread ? 'font-semibold text-[var(--tx-primary)]' : 'text-[var(--tx-secondary)]'}`}>
                    {msg.sujet}
                  </p>
                  <p className="text-xs text-[var(--tx-muted)] mt-0.5 truncate">
                    {msg.contenu}
                  </p>
                </div>

                {isUnread && (
                  <div className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0 mt-2" />
                )}
              </div>
            );
          })
        )}
      </div>

      {showCompose && (
        <ComposeModal
          schoolId={schoolId}
          members={members}
          currentMembershipId=""
          onClose={() => setCompose(false)}
          onSent={() => refetch()}
        />
      )}
    </div>
  );
}
