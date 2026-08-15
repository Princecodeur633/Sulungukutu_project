import jwt from 'jsonwebtoken';

const JWT_SECRET         = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN     = process.env.JWT_EXPIRES_IN ?? '7d';
const REFRESH_SECRET     = process.env.REFRESH_TOKEN_SECRET ?? JWT_SECRET + '_refresh';
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '30d';

export interface JWTPayload {
  profileId:    string;
  email:        string;
  role:         string;
  schoolId?:    string;
  membershipId?: string;
}

export interface RefreshPayload {
  profileId: string;
}

/**
 * Génère un access token JWT
 */
export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Génère un refresh token JWT
 */
export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Vérifie et décode un access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/**
 * Vérifie et décode un refresh token
 */
export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, REFRESH_SECRET) as RefreshPayload;
}

/**
 * Extrait le token du header Authorization
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}
