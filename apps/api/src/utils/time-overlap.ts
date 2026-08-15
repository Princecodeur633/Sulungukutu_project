/**
 * Détection de chevauchement de deux créneaux horaires "HH:MM".
 * Extrait de resolvers/schedule/schedule.resolver.ts pour être testable
 * indépendamment (et potentiellement réutilisé ailleurs sans dupliquer
 * la logique — le frontend avait déjà sa propre copie).
 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function overlaps(s1: string, e1: string, s2: string, e2: string): boolean {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(e1) > timeToMinutes(s2);
}
