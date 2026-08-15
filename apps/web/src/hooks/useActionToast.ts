'use client';

import { useToast } from '@/components/ui/Toast';
import { useCallback } from 'react';

/**
 * Wrapper pour les mutations Apollo avec feedback toast automatique.
 * 
 * Usage :
 *   const run = useActionToast();
 *   await run(
 *     () => createStudent({ variables: { input } }),
 *     { success: 'Élève créé avec succès', errorPrefix: 'Impossible de créer l\'élève' }
 *   );
 */
export function useActionToast() {
  const toast = useToast();

  return useCallback(async <T>(
    fn: () => Promise<T>,
    opts: {
      success?:     string;
      errorPrefix?: string;
    } = {}
  ): Promise<T | null> => {
    try {
      const result = await fn();
      if (opts.success) toast.success(opts.success);
      return result;
    } catch (err: any) {
      const raw     = err?.graphQLErrors?.[0]?.message ?? err?.message ?? 'Erreur inconnue';
      const prefix  = opts.errorPrefix ? `${opts.errorPrefix} : ` : '';
      toast.error('Échec de l\'opération', `${prefix}${raw}`);
      return null;
    }
  }, [toast]);
}
