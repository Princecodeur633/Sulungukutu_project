/**
 * Rate limiter léger en mémoire — sans dépendances externes.
 *
 * Stratégie : fenêtre glissante de 1 minute par IP.
 * Seuils :
 *   - Général    : 120 req/min
 *   - Login      : 10 req/min  (brute-force protection)
 *   - Export     : 20 req/min
 *
 * En production multi-instance → utiliser Redis.
 * Pour une instance unique (Railway/Render) → cette implémentation suffit.
 */

interface RateLimitEntry {
  count:   number;
  resetAt: number; // timestamp ms
}

// Stockage en mémoire (Map<IP, entry>)
const store = new Map<string, RateLimitEntry>();

// Nettoyage toutes les 5 minutes pour éviter les fuites mémoire
// @ts-ignore — setInterval disponible au runtime Node.js
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Vérifie si une IP a dépassé la limite.
 * Retourne { allowed: boolean; remaining: number; resetAt: number }
 */
export function checkRateLimit(
  ip: string,
  limit: number  = 120,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now     = Date.now();
  const key     = ip;
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    // Nouvelle fenêtre
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  existing.count++;

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return {
    allowed:   true,
    remaining: limit - existing.count,
    resetAt:   existing.resetAt,
  };
}

/**
 * Extrait l'IP réelle de la requête (prend en compte les proxies).
 */
export function getClientIp(req: { headers: { get: (h: string) => string | null } }): string {
  // X-Forwarded-For (Railway, Vercel, Cloudflare...)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // Fallback
  return req.headers.get('x-real-ip') ?? '0.0.0.0';
}

/**
 * Middleware de rate limiting pour GraphQL Yoga.
 * À appeler dans buildContext AVANT de traiter la requête.
 */
export function enforceRateLimit(req: {
  url:     string;
  headers: { get: (h: string) => string | null };
}): void {
  // Pas de rate limit en développement
  if (process.env.NODE_ENV !== 'production') return;

  const ip  = getClientIp(req);
  const url = req.url ?? '';

  // Seuil spécifique selon le type de requête
  let limit    = 120;
  let windowMs = 60_000;

  if (url.includes('/export')) {
    limit = 20; // exports lourds
  } else {
    // Détecter les mutations de login dans le body est complexe en streaming.
    // On applique une limite globale raisonnable.
    limit = 120;
  }

  const result = checkRateLimit(ip, limit, windowMs);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    throw Object.assign(
      new Error(`Trop de requêtes. Réessayez dans ${retryAfter}s.`),
      {
        extensions: { code: 'RATE_LIMITED' },
        status:     429,
      }
    );
  }
}

/**
 * Rate limiter strict pour le endpoint /auth/login (brute-force).
 * 10 tentatives par IP par 5 minutes.
 */
export function enforcLoginRateLimit(ip: string): void {
  const result = checkRateLimit(`login:${ip}`, 10, 5 * 60_000);
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    throw new Error(
      `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(retryAfter / 60)} minute(s).`
    );
  }
}
