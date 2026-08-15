import { GraphQLError } from 'graphql';

/**
 * Enveloppe une insertion Drizzle/Postgres pour transformer une violation
 * de contrainte unique (code Postgres 23505) sur email/téléphone en
 * message clair pour l'utilisateur, plutôt que de laisser remonter une
 * erreur SQL brute (ou le message générique "Unexpected error." masqué
 * par défaut par graphql-yoga, qui ne dit pas à l'admin ce qui a coincé).
 *
 * Peut arriver en cas de requêtes concurrentes : deux créations
 * simultanées avec le même téléphone peuvent toutes les deux passer la
 * vérification applicative (SELECT) avant que l'une des deux échoue à
 * l'écriture — la contrainte DB est le vrai filet de sécurité final.
 */
export async function withFriendlyUniqueError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.code === '23505') {
      const constraint = String(err.constraint ?? '');
      if (constraint.includes('phone')) {
        throw new GraphQLError(
          'Ce numéro de téléphone est déjà associé à un autre compte.',
          { extensions: { code: 'DUPLICATE_PHONE' } }
        );
      }
      if (constraint.includes('email')) {
        throw new GraphQLError(
          'Cet email est déjà associé à un autre compte.',
          { extensions: { code: 'DUPLICATE_EMAIL' } }
        );
      }
    }
    throw err;
  }
}
