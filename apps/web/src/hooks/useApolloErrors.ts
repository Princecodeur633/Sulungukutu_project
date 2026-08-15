'use client';

import { useEffect } from 'react';
import { apolloErrorBus } from '@/lib/apollo/client';
import { useToast } from '@/components/ui/Toast';

/**
 * À monter une seule fois dans l'arbre (ex: providers.tsx ou layout racine).
 * Écoute les erreurs Apollo et les affiche via toast.
 */
export function useApolloErrors() {
  const toast = useToast();

  useEffect(() => {
    const off = apolloErrorBus.on((msg) => {
      toast.error('Erreur réseau', msg);
    });
    return () => { off(); };
  }, [toast]);
}
