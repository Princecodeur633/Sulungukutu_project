import { db } from '../db';
import { globalProfiles, schoolMemberships } from '../db/schema';
import { extractBearerToken, verifyAccessToken, JWTPayload } from '../utils/jwt';
import { enforceRateLimit } from './rate-limit';
import { eq } from 'drizzle-orm';
import type { YogaInitialContext } from 'graphql-yoga';

// ============================================================
// Contexte GraphQL
// ============================================================

// graphql-yoga expose Request via YogaInitialContext
type YogaRequest = YogaInitialContext['request'];

export interface GraphQLContext {
  db:             typeof db;
  currentUser:    JWTPayload | null;
  request?:       YogaRequest;
}

/**
 * Vérifie un token d'accès et renvoie l'utilisateur courant, ou null.
 * Partagé entre le contexte HTTP (requêtes/mutations) et le contexte
 * WebSocket (abonnements temps réel) — les deux doivent appliquer
 * exactement la même logique de vérification (signature + statut actif
 * du membership), sinon les abonnements pourraient rester ouverts pour
 * un compte désactivé alors que les requêtes HTTP le refusent déjà.
 */
export async function resolveCurrentUser(token: string | null | undefined): Promise<JWTPayload | null> {
  if (!token) return null;
  try {
    const currentUser = verifyAccessToken(token);

    const [profile] = await db
      .select({
        id: globalProfiles.id,
        isSuperAdmin: globalProfiles.isSuperAdmin,
        passwordChangedAt: globalProfiles.passwordChangedAt,
      })
      .from(globalProfiles)
      .where(eq(globalProfiles.id, currentUser.profileId))
      .limit(1);

    if (!profile) return null;

    // Invalide les JWT émis avant un changement / reset de mot de passe.
    if (profile.passwordChangedAt && currentUser.iat) {
      const changedMs = profile.passwordChangedAt.getTime();
      if (currentUser.iat * 1000 < changedMs - 2000) {
        return null;
      }
    }

    if (profile.isSuperAdmin) {
      return { ...currentUser, role: 'SUPER_ADMIN' };
    }

    // Le JWT ne fait que prouver qu'un token valide a été émis un jour ;
    // il ne reflète pas un éventuel changement de statut depuis (compte
    // désactivé/suspendu par un admin). On revérifie donc l'état réel du
    // membership à chaque requête, pour que la désactivation prenne effet
    // immédiatement plutôt qu'à l'expiration naturelle du token (jusqu'à 7j).
    if (currentUser.membershipId) {
      const [membership] = await db
        .select({ status: schoolMemberships.status })
        .from(schoolMemberships)
        .where(eq(schoolMemberships.id, currentUser.membershipId))
        .limit(1);

      if (!membership || membership.status !== 'ACTIVE') {
        return null;
      }
    }
    return currentUser;
  } catch {
    return null;
  }
}

/**
 * Construit le contexte GraphQL pour chaque requête HTTP (queries/mutations)
 */
export async function buildContext({
  request,
}: {
  request: YogaRequest;
}): Promise<GraphQLContext> {
  // ── Rate limiting (production uniquement) ─────────────────
  enforceRateLimit(request as any);

  const authHeader = request.headers.get('authorization') ?? undefined;
  const token      = extractBearerToken(authHeader);
  const currentUser = await resolveCurrentUser(token);

  return {
    db,
    currentUser,
    request,
  };
}

/**
 * Construit le contexte GraphQL pour chaque connexion WebSocket (abonnements).
 * Le jeton est transmis via `connectionParams` au moment du handshake
 * (voir apps/web/src/lib/apollo/client.ts, `connectionParams`), et non via
 * un en-tête HTTP classique puisqu'il n'y a pas de nouvelle requête HTTP
 * pour chaque message d'abonnement.
 */
export async function buildWsContext(
  connectionParams: Record<string, unknown> | undefined
): Promise<GraphQLContext> {
  const authValue = connectionParams?.authorization;
  const token = extractBearerToken(typeof authValue === 'string' ? authValue : undefined);
  const currentUser = await resolveCurrentUser(token);

  return {
    db,
    currentUser,
  };
}
