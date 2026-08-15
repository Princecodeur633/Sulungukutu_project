import { ApolloClient, InMemoryCache, createHttpLink, split, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';
const WS_URL  = process.env.NEXT_PUBLIC_WS_URL  ?? 'ws://localhost:4000/graphql';

// ── HTTP Link ─────────────────────────────────────────────────
const httpLink = createHttpLink({
  uri: API_URL,
});

// ── Auth Link (injection du token JWT) ───────────────────────
const authLink = setContext((_, { headers }) => {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('sulungukutu_token')
      : null;

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// ── WebSocket Link (subscriptions) ───────────────────────────
const wsLink =
  typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: WS_URL,
          connectionParams: () => {
            const token = localStorage.getItem('sulungukutu_token');
            return { authorization: token ? `Bearer ${token}` : '' };
          },
        })
      )
    : null;

// ── Error Link (gestion globale des erreurs Apollo) ─────────────
// On publie sur un event bus léger pour que le ToastProvider puisse écouter
// sans créer de dépendance circulaire (Apollo client est initialisé côté serveur)
export const apolloErrorBus = {
  listeners: new Set<(msg: string) => void>(),
  emit(msg: string) {
    this.listeners.forEach((fn) => fn(msg));
  },
  on(fn: (msg: string) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
};

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (networkError) {
    const msg =
      'networkError' in networkError && (networkError as any).statusCode === 401
        ? 'Session expirée — veuillez vous reconnecter'
        : 'Impossible de joindre le serveur. Vérifiez votre connexion.';
    apolloErrorBus.emit(msg);
  }
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      // Ne pas afficher les erreurs d'auth (gérées par le middleware)
      if (err.extensions?.code === 'UNAUTHENTICATED') continue;
      if (err.extensions?.code === 'FORBIDDEN') {
        apolloErrorBus.emit('Accès refusé — permissions insuffisantes');
        continue;
      }
      // Erreur métier : afficher le message GraphQL
      apolloErrorBus.emit(err.message || 'Une erreur est survenue');
    }
  }
});

// ── Split Link (HTTP pour queries/mutations, WS pour subscriptions) ──
const splitLink =
  typeof window !== 'undefined' && wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        from([errorLink, authLink.concat(httpLink)])
      )
    : from([errorLink, authLink.concat(httpLink)]);

// ── Client Apollo ─────────────────────────────────────────────
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          studentsByClass: { keyArgs: ['classId'] },
          gradesByStudent: { keyArgs: ['filter'] },
          myNotifications: {
            keyArgs: false,
            merge(existing = { data: [] }, incoming) {
              return {
                ...incoming,
                data: [...(existing.data ?? []), ...(incoming.data ?? [])],
              };
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});

// ── Helpers auth storage ──────────────────────────────────────
// Décode le payload JWT sans vérifier la signature (usage client uniquement)
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export const tokenStorage = {
  set: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sulungukutu_token', token);
      // Cookie lisible par le middleware Next.js (pas httpOnly — client-side only)
      const payload = decodeJwtPayload(token);
      const maxAge  = payload?.exp
        ? payload.exp - Math.floor(Date.now() / 1000)
        : 7 * 24 * 3600;
      const role    = payload?.role ?? '';
      document.cookie = `edu_token=${token}; path=/; max-age=${maxAge}; SameSite=Strict`;
      document.cookie = `edu_role=${role}; path=/; max-age=${maxAge}; SameSite=Strict`;
    }
  },
  get: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sulungukutu_token');
    }
    return null;
  },
  // Alias pour la compatibilité
  getToken: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sulungukutu_token');
    }
    return null;
  },
  clear: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sulungukutu_token');
      localStorage.removeItem('sulungukutu_school_id');
      document.cookie = 'edu_token=; path=/; max-age=0';
      document.cookie = 'edu_role=; path=/; max-age=0';
    }
  },
  setSchoolId: (schoolId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sulungukutu_school_id', schoolId);
    }
  },
  getSchoolId: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sulungukutu_school_id');
    }
    return null;
  },
  // Utilisé pour les abonnements temps réel (ex: messagerie) qui ont besoin
  // de savoir "qui reçoit" sans dépendre d'une requête réseau supplémentaire.
  getMembershipId: (): string | null => {
    const token = tokenStorage.get();
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    return payload?.membershipId ?? null;
  },
};

