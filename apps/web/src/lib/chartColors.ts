/**
 * Palette catégorielle unique de la plateforme — à utiliser PARTOUT où une
 * couleur "de série" ou "de catégorie" est nécessaire (icônes d'action
 * rapide, graphiques recharts, StatCards...), plutôt que des hex en dur
 * dispersés page par page (ex: #6366f1, #8b5cf6 trouvés dans
 * admin/dashboard). Reprend exactement les tokens définis dans
 * globals.css, pour garantir un rendu identique en light ET dark mode
 * (recharts ne peut pas résoudre les CSS custom properties dans un
 * contexte SVG/canvas selon le navigateur, donc on expose ici la valeur
 * hex correspondante en plus du nom de la variable CSS).
 */

export const chartColors = {
  accent:  '#4f46e5', // indigo — identité principale de la plateforme
  amber:   '#f59e0b', // accent secondaire
  emerald: '#059669', // succès / positif
  sky:     '#0ea5e9', // information / neutre
  rose:    '#dc2626', // alerte / négatif
  violet:  '#8b5cf6', // 6e teinte si besoin d'une série de plus
} as const;

/** Ordre fixe pour les séries de graphiques (ne jamais réordonner selon le contexte). */
export const chartSeries: string[] = [
  chartColors.accent,
  chartColors.amber,
  chartColors.emerald,
  chartColors.sky,
  chartColors.rose,
  chartColors.violet,
];

/** Couleurs "de statut" — toujours la même association partout dans l'app. */
export const statusColors = {
  success: chartColors.emerald,
  warning: chartColors.amber,
  danger:  chartColors.rose,
  info:    chartColors.sky,
  neutral: '#8b8797',
} as const;

/**
 * Icône Lucide standard par domaine métier — un domaine = toujours la même
 * icône, pour que l'utilisateur associe visuellement un pictogramme à un
 * concept, quelle que soit la page.
 * (import correspondant à faire dans le composant : ces clés servent de
 * documentation/mapping, pas d'import direct pour éviter d'alourdir le bundle)
 */
export const domainIcon = {
  eleves:      'GraduationCap',
  enseignants: 'Users',
  paiements:   'Wallet',
  presence:    'UserCheck',
  notes:       'BarChart2',
  bulletins:   'FileText',
  emploiTemps: 'Calendar',
  annonces:    'Megaphone',
  messages:    'MessageSquare',
  classes:     'BookOpen',
} as const;
