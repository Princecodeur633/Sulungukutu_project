/**
 * Transforme une erreur GraphQL/réseau en message lisible et précis
 */
export function parseGqlError(err: any): string {
  if (!err) return 'Erreur inconnue';

  // GraphQL errors array
  if (err.graphQLErrors?.length > 0) {
    const e = err.graphQLErrors[0];
    const code = e.extensions?.code;
    const msg  = e.message;

    // Erreurs connues → messages précis en français
    if (code === 'FORBIDDEN' || msg?.includes('Accès refusé'))
      return 'Accès refusé — vous n\'avez pas les droits pour cette action.';
    if (code === 'UNAUTHENTICATED' || msg?.includes('non authentifié') || msg?.includes('auth'))
      return 'Session expirée — veuillez vous reconnecter.';
    if (msg?.includes('déjà') || msg?.includes('unique') || msg?.includes('already'))
      return 'Cet élément existe déjà dans le système.';
    if (msg?.includes('introuvable') || msg?.includes('not found') || msg?.includes('n\'existe pas'))
      return 'Élément introuvable — il a peut-être été supprimé.';
    if (msg?.includes('obligatoire') || msg?.includes('required') || msg?.includes('cannot be null'))
      return 'Champs obligatoires manquants — vérifiez le formulaire.';
    if (msg?.includes('email'))
      return `Erreur email : ${msg}`;
    if (msg?.includes('DateTime') || msg?.includes('date'))
      return 'Format de date invalide — utilisez le format JJ/MM/AAAA.';
    if (msg?.includes('classe') || msg?.includes('class'))
      return `Erreur classe : ${msg}`;
    if (msg) return msg;
  }

  // Network error
  if (err.networkError) {
    const status = err.networkError.statusCode;
    if (status === 401) return 'Session expirée — veuillez vous reconnecter.';
    if (status === 403) return 'Accès refusé.';
    if (status === 404) return 'Service introuvable — vérifiez votre connexion.';
    if (status >= 500) return 'Erreur serveur — réessayez dans un moment.';
    if (!navigator.onLine) return 'Pas de connexion internet.';
    return 'Impossible de contacter le serveur.';
  }

  // Fallback
  return err.message || 'Une erreur inattendue est survenue.';
}

/**
 * Wrapper pour useMutation avec gestion d'erreur automatique
 */
export function handleMutationError(err: any, addToast: (t: any) => void, customTitle?: string) {
  const message = parseGqlError(err);
  addToast({
    type:    'error',
    title:   customTitle ?? 'Erreur',
    message,
  });
  console.error('[GraphQL Error]', err);
}
