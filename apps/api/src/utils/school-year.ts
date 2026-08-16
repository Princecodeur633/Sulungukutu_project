/**
 * Mois scolaire : Septembre=1 … Mai=9. Juin–août = hors période (0).
 */
const CALENDAR_TO_SCHOOL: Record<number, number> = {
  9: 1, 10: 2, 11: 3, 12: 4,
  1: 5,  2: 6,  3: 7,  4: 8,  5: 9,
};

export function getMoisScolaire(moisCalendaire: number): number {
  return CALENDAR_TO_SCHOOL[moisCalendaire] ?? 0;
}

export function currentMoisScolaire(now: Date = new Date()): number {
  return getMoisScolaire(now.getMonth() + 1);
}

/** JS getDay() : 0=dimanche … 6=samedi → 1=lundi … 6=samedi, 7=dimanche. */
export function currentJourEmploi(now: Date = new Date()): number {
  const d = now.getDay();
  return d === 0 ? 7 : d;
}
