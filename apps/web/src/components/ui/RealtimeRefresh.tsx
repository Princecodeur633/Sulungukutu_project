'use client';
import { useEffect } from 'react';
import { apolloClient } from '@/lib/apollo/client';

/**
 * Garde les données à jour partout dans l'application, automatiquement :
 *
 *  1. Au retour sur l'onglet (l'utilisateur avait changé d'onglet ou
 *     minimisé la fenêtre, puis revient) — très fréquent en usage réel.
 *  2. À intervalle régulier en arrière-plan, tant que l'onglet est actif.
 *  3. Quand la connexion réseau revient après une coupure.
 *
 * Ne rafraîchit QUE les requêtes actuellement montées à l'écran
 * (`reFetchObservableQueries`), donc pas de charge inutile sur des pages
 * non visitées. Complète — sans les remplacer — les rafraîchissements déjà
 * déclenchés explicitement après une action (refetch() après une mutation).
 */
const REFRESH_INTERVAL_MS = 45_000; // 45s

export function RealtimeRefresh() {
  useEffect(() => {
    const refetchActive = () => {
      // Évite de rafraîchir un onglet caché/minimisé (économise la charge serveur)
      if (document.visibilityState !== 'visible') return;
      apolloClient.reFetchObservableQueries().catch(() => {
        /* une requête individuelle en erreur ne doit pas interrompre les autres */
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetchActive();
    };

    window.addEventListener('focus', refetchActive);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', refetchActive);

    const interval = setInterval(refetchActive, REFRESH_INTERVAL_MS);

    return () => {
      window.removeEventListener('focus', refetchActive);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', refetchActive);
      clearInterval(interval);
    };
  }, []);

  return null;
}
