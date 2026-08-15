import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Générateur de codes courts uniques
// Format : [ROLE]-[INITIALES]-[4 hex aléatoires]
// Exemples : ADM-KGL-4F2A | TCH-MBK-9X1C | STU-GEX-7B3D
// ============================================================

type RolePrefix = 'SUP' | 'ADM' | 'TCH' | 'PAR' | 'STU' | 'SCH' | 'USR';

/**
 * Génère un code court lisible pour un utilisateur ou un établissement
 */
export function generateShortCode(
  prefix: RolePrefix,
  nom: string,
  prenom?: string
): string {
  const initiales = buildInitiales(nom, prenom);
  const random = generateHex(4);
  return `${prefix}-${initiales}-${random}`.toUpperCase();
}

/**
 * Génère un code établissement numéroté
 * Format : SCH-[3 premières lettres]-[4 chiffres]
 */
export function generateSchoolCode(nom: string, count: number): string {
  const abbrev = nom
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  const num = String(count).padStart(4, '0');
  return `SCH-${abbrev}-${num}`;
}

/**
 * Construit les initiales à partir du nom et prénom
 */
function buildInitiales(nom: string, prenom?: string): string {
  const cleanNom = nom.replace(/[^a-zA-Z]/g, '');
  const cleanPrenom = prenom ? prenom.replace(/[^a-zA-Z]/g, '') : '';

  if (cleanPrenom) {
    // Première lettre du prénom + première lettre du nom + lettre aléatoire du nom
    const p = cleanPrenom[0] || 'X';
    const n = cleanNom[0] || 'X';
    const extra = cleanNom[1] || cleanPrenom[1] || 'X';
    return `${p}${n}${extra}`.toUpperCase();
  }

  // Seulement le nom
  return cleanNom.substring(0, 3).padEnd(3, 'X').toUpperCase();
}

/**
 * Génère N caractères hexadécimaux aléatoires
 */
function generateHex(length: number): string {
  const chars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Génère un UUID v4
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Génère un numéro de reçu lisible pour une transaction de paiement validée.
 * Format : REC-[année scolaire compactée]-[6 hex aléatoires]
 * Ex : REC-20242025-4F2A9B
 */
export function generateNumeroRecu(anneeScolaire: string): string {
  const annee = anneeScolaire.replace('-', '');
  return `REC-${annee}-${generateHex(6)}`.toUpperCase();
}

/**
 * Génère une référence technique unique pour une transaction (guichet ou distance).
 * Sert de clé d'idempotence et de référence pour un futur vrai fournisseur de paiement.
 * Format : TXN-[timestamp base36]-[8 hex aléatoires]
 */
export function generateTransactionRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `TXN-${ts}-${generateHex(8)}`;
}

/**
 * Mappe le rôle vers son préfixe de code
 */
export function roleToPrefixCode(role: string): RolePrefix {
  const map: Record<string, RolePrefix> = {
    SUPER_ADMIN: 'SUP',
    ADMIN:       'ADM',
    TEACHER:     'TCH',
    PARENT:      'PAR',
    STUDENT:     'STU',
  };
  return map[role] ?? 'USR';
}

/**
 * Génère un matricule élève unique
 * Même chose que STU code mais avec format différent pour l'affichage scolaire
 */
export function generateMatricule(
  anneeScolaire: string,
  nom: string,
  prenom: string,
  sequence: number
): string {
  const annee = anneeScolaire.replace('-', '').substring(0, 4);
  const initiales = buildInitiales(nom, prenom);
  const seq = String(sequence).padStart(4, '0');
  return `${annee}-${initiales}-${seq}`;
}
