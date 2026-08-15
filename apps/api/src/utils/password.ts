/**
 * Génère un mot de passe temporaire sécurisé (10 caractères, lettres
 * ambiguës exclues + symboles). Centralisé ici — ce code existait
 * auparavant dupliqué (avec de légères variations) dans 4 resolvers
 * différents (auth, school, student, user).
 */
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
