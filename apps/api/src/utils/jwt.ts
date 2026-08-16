import jwt from 'jsonwebtoken';

function requireSecret(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value || value.includes('change_me')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${name} doit être défini avec une valeur forte en production.`);
    }
    console.warn(`[jwt] ${name} manquant ou trop faible — secret de développement utilisé.`);
    return value || `dev-only-${name.toLowerCase()}`;
  }
  return value;
}

const JWT_SECRET         = requireSecret('JWT_SECRET');
const JWT_EXPIRES_IN     = process.env.JWT_EXPIRES_IN ?? '7d';
const REFRESH_SECRET     = requireSecret('REFRESH_TOKEN_SECRET', JWT_SECRET + '_refresh');
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '30d';
const RESET_EXPIRES_IN   = '1h';

export interface JWTPayload {
  profileId:    string;
  email:        string;
  role:         string;
  schoolId?:    string;
  membershipId?: string;
  iat?:         number;
}

export interface RefreshPayload {
  profileId:     string;
  schoolId?:     string;
  membershipId?: string;
}

export interface PasswordResetPayload {
  profileId: string;
  purpose:   'password_reset';
}

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signPasswordResetToken(profileId: string): string {
  const payload: PasswordResetPayload = { profileId, purpose: 'password_reset' };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: RESET_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, REFRESH_SECRET) as RefreshPayload;
}

export function verifyPasswordResetToken(token: string): PasswordResetPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as PasswordResetPayload;
  if (decoded.purpose !== 'password_reset' || !decoded.profileId) {
    throw new Error('Token de réinitialisation invalide');
  }
  return decoded;
}

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}
