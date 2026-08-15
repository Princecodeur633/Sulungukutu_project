/**
 * Normalise un numéro de téléphone congolais pour comparaison fiable.
 * Retire espaces, tirets, points ; unifie le préfixe international.
 * Ex: "+242 06 123 45 67", "06-123-45-67", "242061234567" → "061234567"
 *
 * Utilisé à la fois à l'enregistrement (identity.service.ts) et à la
 * connexion (auth.resolver.ts) pour garantir que la même personne tapant
 * son numéro sous des formats différents soit toujours reconnue.
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, ''); // retire espaces, tirets, points, parenthèses
  digits = digits.replace(/^\+?242/, '');   // retire l'indicatif pays (+242 ou 242)
  digits = digits.replace(/^\+/, '');
  if (digits.length === 8 && !digits.startsWith('0')) {
    digits = '0' + digits; // réintroduit le 0 initial si l'indicatif l'a mangé
  }
  return digits;
}
