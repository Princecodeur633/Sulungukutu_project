'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { MessageSquare, Send } from 'lucide-react';
import { SEND_MESSAGE_MUTATION } from '@/lib/graphql/queries';
import { parseGqlError } from '@/lib/errorUtils';
import { useToast } from '@/components/ui/Toast';
import { FormModal, FormField, FormSection, FormActions } from '@/components/ui/FormModal';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', TEACHER: 'Enseignant', PARENT: 'Parent', STUDENT: 'Élève', SUPER_ADMIN: 'Super-admin',
};

export function ComposeMessageModal({
  schoolId, members, currentMembershipId, onClose, onSent,
}: {
  schoolId: string;
  members: any[];
  currentMembershipId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [receiverId, setReceiver] = useState('');
  const [sujet, setSujet] = useState('');
  const [contenu, setContenu] = useState('');
  const [sendMessage, { loading }] = useMutation(SEND_MESSAGE_MUTATION);
  const { addToast } = useToast();

  const handleSend = async () => {
    if (!receiverId || !sujet.trim() || !contenu.trim()) {
      addToast({ type: 'warning', title: 'Champs manquants', message: 'Destinataire, sujet et contenu sont requis.' });
      return;
    }
    try {
      await sendMessage({ variables: { input: { schoolId, receiverId, sujet, contenu } } });
      addToast({ type: 'success', title: 'Message envoyé' });
      onSent();
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur envoi', message: parseGqlError(err) });
    }
  };

  const others = members.filter((m) => m.id !== currentMembershipId);

  return (
    <FormModal
      title="Nouveau message"
      subtitle="Échange interne à l’établissement."
      icon={<MessageSquare size={18} style={{ color: 'var(--accent)' }} />}
      onClose={onClose}
      onSubmit={handleSend}
      maxWidth={560}
      footer={
        <FormActions
          submitLabel={loading ? 'Envoi…' : 'Envoyer'}
          loading={loading}
          onCancel={onClose}
          disabled={!receiverId || !sujet.trim() || !contenu.trim()}
        />
      }
    >
      <FormSection icon={<Send size={14} style={{ color: 'var(--accent)' }} />} title="Message">
        <FormField label="Destinataire" required>
          <select className="input" value={receiverId} onChange={(e) => setReceiver(e.target.value)}>
            <option value="">Sélectionner…</option>
            {others.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.profile?.prenom} {m.profile?.nom} — {ROLE_LABELS[m.role] ?? m.role}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Sujet" required>
          <input className="input" value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Objet du message" />
        </FormField>
        <FormField label="Message" required>
          <textarea
            className="input resize-none"
            rows={5}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Écrivez votre message…"
          />
        </FormField>
      </FormSection>
    </FormModal>
  );
}
