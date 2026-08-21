import { tokenStorage } from '@/lib/apollo/client';

/** Origine de l'API (sans /graphql). */
export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return raw.replace(/\/graphql\/?$/, '');
}

/** URL complète d'un document API (reçu, bulletin) avec le jeton d'auth. */
export function apiDocumentUrl(path: string): string {
  const base = getApiBase();
  const clean = /^https?:\/\//.test(path)
    ? path
    : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const token = tokenStorage.get() ?? '';
  const sep = clean.includes('?') ? '&' : '?';
  return `${clean}${sep}token=${encodeURIComponent(token)}`;
}

export function openApiDocument(path: string | null | undefined) {
  if (!path) return;
  window.open(apiDocumentUrl(path), '_blank', 'noopener,noreferrer');
}
