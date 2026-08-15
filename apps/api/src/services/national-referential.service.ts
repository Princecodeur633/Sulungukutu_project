import { eq, and, inArray } from 'drizzle-orm';
import {
  nationalLevels, nationalSeries, nationalSubjects, nationalCurriculum,
  levels, subjects, classes,
} from '../db/schema';
import type { DB } from '../db';

// ============================================================
// RÉFÉRENTIEL NATIONAL — République du Congo (Congo-Brazzaville)
// ------------------------------------------------------------
// Structure des cycles PRIMAIRE / COLLÈGE / LYCÉE (le cycle UNIVERSITAIRE
// est volontairement exclu de ce référentiel, comme demandé).
//
// ⚠️ Les coefficients et volumes horaires ci-dessous sont des valeurs
// INDICATIVES par défaut, fournies pour amorcer le système. Ils doivent
// être vérifiés/ajustés par un administrateur pédagogique par rapport aux
// arrêtés officiels en vigueur — ils ne sont pas une reproduction certifiée
// d'un texte réglementaire. C'est précisément pour cette raison que chaque
// établissement peut les personnaliser localement (classSubjects.coefficient
// reste l'autorité locale, jamais figée par cette table nationale).
// ============================================================

type CycleSeed = {
  cycle: 'PRIMAIRE' | 'COLLEGE' | 'LYCEE';
  niveaux: string[];
};

const CYCLES: CycleSeed[] = [
  { cycle: 'PRIMAIRE', niveaux: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'] },
  { cycle: 'COLLEGE',  niveaux: ['6ème', '5ème', '4ème', '3ème'] },
  { cycle: 'LYCEE',    niveaux: ['2nde', '1ère', 'Terminale'] },
];

const SERIES = [
  { code: 'A', nom: 'Série A — Littéraire' },
  { code: 'C', nom: 'Série C — Mathématiques et Sciences Physiques' },
  { code: 'D', nom: 'Série D — Sciences de la Nature' },
];

const SUBJECTS = [
  { code: 'FR',   nom: 'Français' },
  { code: 'MATH', nom: 'Mathématiques' },
  { code: 'ANG',  nom: 'Anglais' },
  { code: 'HG',   nom: 'Histoire-Géographie' },
  { code: 'SVT',  nom: 'Sciences de la Vie et de la Terre' },
  { code: 'PC',   nom: 'Physique-Chimie' },
  { code: 'EPS',  nom: 'Éducation Physique et Sportive' },
  { code: 'ECM',  nom: 'Éducation Civique et Morale' },
  { code: 'PHILO', nom: 'Philosophie' },
  { code: 'ESP',  nom: 'Espagnol (LV2)' },
];

// Grille de coefficients par défaut, par cycle (indicative — voir avertissement plus haut).
const DEFAULT_COEFFICIENTS: Record<string, Record<string, number>> = {
  PRIMAIRE: { FR: 4, MATH: 4, ANG: 1, HG: 2, SVT: 2, EPS: 1, ECM: 1 },
  COLLEGE:  { FR: 4, MATH: 4, ANG: 2, HG: 2, SVT: 2, PC: 2, EPS: 1, ECM: 1, ESP: 2 },
  LYCEE:    { FR: 2, MATH: 4, ANG: 2, HG: 2, SVT: 2, PC: 3, EPS: 1, PHILO: 3, ESP: 2 },
};

export const nationalReferentialService = {
  /**
   * Seed idempotent du référentiel national (à exécuter une fois, ex. au
   * démarrage ou via un script de migration). Ne recrée rien si déjà présent.
   */
  seed: async (db: DB): Promise<void> => {
    const existing = await db.query.nationalLevels.findFirst();
    if (existing) return; // déjà seedé

    let ordre = 1;
    const levelRows: { id?: string; cycle: string; nom: string; ordre: number }[] = [];
    for (const { cycle, niveaux } of CYCLES) {
      for (const nom of niveaux) {
        levelRows.push({ cycle, nom, ordre: ordre++ });
      }
    }
    const insertedLevels = await db.insert(nationalLevels).values(levelRows as any).returning();
    const insertedSeries = await db.insert(nationalSeries).values(SERIES).returning();
    const insertedSubjects = await db.insert(nationalSubjects).values(SUBJECTS).returning();

    const subjectByCode = Object.fromEntries(insertedSubjects.map((s) => [s.code, s]));

    const curriculumRows: any[] = [];
    for (const level of insertedLevels) {
      const cycleCoefs = DEFAULT_COEFFICIENTS[level.cycle] ?? {};
      const isLycee = level.cycle === 'LYCEE';
      const seriesForLevel = isLycee && level.nom !== '2nde' ? insertedSeries : [null];

      for (const serie of seriesForLevel) {
        for (const [code, coefficient] of Object.entries(cycleCoefs)) {
          const subject = subjectByCode[code];
          if (!subject) continue;
          curriculumRows.push({
            nationalLevelId:  level.id,
            nationalSeriesId: serie?.id ?? null,
            nationalSubjectId: subject.id,
            coefficient:      coefficient.toFixed(2),
            volumeHoraireHebdo: null,
          });
        }
      }
    }
    if (curriculumRows.length > 0) {
      await db.insert(nationalCurriculum).values(curriculumRows);
    }
  },

  /**
   * Provisionne automatiquement la configuration pédagogique d'un nouvel
   * établissement à partir du référentiel national — sans aucune saisie
   * manuelle. Idempotent : ne recrée pas un niveau/matière déjà activé.
   *
   * @param cycles cycles à activer par défaut (ex: ['COLLEGE', 'LYCEE'] pour
   *   un établissement secondaire). Par défaut : les 3 cycles.
   */
  provisionSchool: async (
    db: DB,
    schoolId: string,
    cycles: Array<'PRIMAIRE' | 'COLLEGE' | 'LYCEE'> = ['PRIMAIRE', 'COLLEGE', 'LYCEE'],
    anneeScolaire: string = '2024-2025',
    // Lettre(s)/numéro(s) de division à créer par défaut pour chaque niveau
    // SANS série (primaire/collège/2nde), ex: ['1'] crée une seule classe
    // par niveau ("6ème 1"), ['1','2','3','4'] en crée quatre. Les LETTRES
    // (A/C/D...) sont réservées aux séries de lycée (voir plus bas) — elles
    // n'ont rien à voir avec le nombre de sections d'un même niveau.
    divisions: string[] = ['1', '2', '3', '4']
  ): Promise<{ levelsCreated: number; subjectsCreated: number; classesCreated: number }> => {
    const natLevels = await db.query.nationalLevels.findMany({
      where: inArray(nationalLevels.cycle, cycles as any),
      orderBy: (l, { asc }) => [asc(l.ordre)],
    });

    const alreadyActivatedLevels = await db.query.levels.findMany({
      where: eq(levels.schoolId, schoolId),
    });
    const activatedByNationalId = new Map(
      alreadyActivatedLevels.filter((l) => l.nationalLevelId).map((l) => [l.nationalLevelId as string, l])
    );

    const levelInserts = natLevels
      .filter((nl) => !activatedByNationalId.has(nl.id))
      .map((nl) => ({
        schoolId,
        nationalLevelId: nl.id,
        isActive: true,
        nom:  nl.nom,
        type: nl.cycle,
        ordre: nl.ordre,
      }));
    const newlyInsertedLevels = levelInserts.length > 0
      ? await db.insert(levels).values(levelInserts as any).returning()
      : [];
    for (const l of newlyInsertedLevels) {
      if (l.nationalLevelId) activatedByNationalId.set(l.nationalLevelId, l);
    }

    // Toutes les matières nationales utilisées par ces cycles (déduplication).
    const curriculumEntries = await db.query.nationalCurriculum.findMany({
      where: inArray(
        nationalCurriculum.nationalLevelId,
        natLevels.map((l) => l.id)
      ),
      with: { subject: true },
    });
    const uniqueSubjects = new Map<string, { id: string; nom: string }>();
    for (const entry of curriculumEntries as any[]) {
      if (entry.subject) uniqueSubjects.set(entry.subject.id, entry.subject);
    }

    const alreadyActivatedSubjects = await db.query.subjects.findMany({
      where: eq(subjects.schoolId, schoolId),
      columns: { nationalSubjectId: true },
    });
    const activatedSubjectIds = new Set(
      alreadyActivatedSubjects.map((s) => s.nationalSubjectId).filter(Boolean)
    );

    const subjectInserts = [...uniqueSubjects.values()]
      .filter((s) => !activatedSubjectIds.has(s.id))
      .map((s) => ({
        schoolId,
        nationalSubjectId: s.id,
        isActive: true,
        nom: s.nom,
      }));
    if (subjectInserts.length > 0) {
      await db.insert(subjects).values(subjectInserts as any);
    }

    // ── Classes (divisions) ────────────────────────────────────
    // Pour chaque niveau désormais activé : une classe par division par
    // défaut (ex: "6ème A"). Au Lycée, dès qu'un niveau a des séries dans
    // le référentiel (1ère, Terminale), les classes sont numérotées PAR
    // SÉRIE (ex: "Terminale D1", "Terminale D2", "Terminale C1"...) au lieu
    // d'une lettre de division — la lettre de série suffit à identifier la
    // filière, le numéro distingue les sections multiples de cette même
    // série. La 2nde reste en tronc commun (divisions classiques A/B/C/D).
    const allSchoolLevels = [...activatedByNationalId.values()];
    const existingClasses = await db.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
    });
    const existingClassKey = (levelId: string, nom: string) => `${levelId}::${nom}`;
    const existingClassKeys = new Set(existingClasses.map((c) => existingClassKey(c.levelId, c.nom)));

    const allSeries = await db.query.nationalSeries.findMany();
    const seriesByLevelId = new Map<string, typeof allSeries>();
    for (const entry of curriculumEntries as any[]) {
      if (!entry.nationalSeriesId) continue;
      const list = seriesByLevelId.get(entry.nationalLevelId) ?? [];
      if (!list.some((s: any) => s.id === entry.nationalSeriesId)) {
        const serie = allSeries.find((s) => s.id === entry.nationalSeriesId);
        if (serie) list.push(serie);
      }
      seriesByLevelId.set(entry.nationalLevelId, list);
    }

    const classInserts: any[] = [];
    for (const level of allSchoolLevels) {
      if (!level.nationalLevelId) continue;
      const seriesForLevel = seriesByLevelId.get(level.nationalLevelId);

      if (seriesForLevel && seriesForLevel.length > 0) {
        // Lycée avec séries (1ère/Terminale) : la lettre de série (A/C/D...)
        // identifie déjà la filière — les sections multiples de la MÊME
        // série se distinguent par un numéro (D1, D2, D3...), pas par une
        // seconde lettre. Nombre de sections = même compte que `divisions`.
        for (const serie of seriesForLevel) {
          for (let i = 1; i <= divisions.length; i++) {
            const nom = `${level.nom} ${serie.code}${i}`;
            if (existingClassKeys.has(existingClassKey(level.id, nom))) continue;
            classInserts.push({
              schoolId,
              levelId: level.id,
              nationalSeriesId: serie.id,
              nom,
              anneeScolaire,
            });
          }
        }
      } else {
        for (const division of divisions) {
          const nom = `${level.nom} ${division}`;
          if (existingClassKeys.has(existingClassKey(level.id, nom))) continue;
          classInserts.push({ schoolId, levelId: level.id, nom, anneeScolaire });
        }
      }
    }
    if (classInserts.length > 0) {
      await db.insert(classes).values(classInserts);
    }

    return {
      levelsCreated: levelInserts.length,
      subjectsCreated: subjectInserts.length,
      classesCreated: classInserts.length,
    };
  },

  /** Coefficient officiel par défaut, utilisé pour pré-remplir un classSubject. */
  getDefaultCoefficient: async (
    db: DB,
    nationalLevelId: string,
    nationalSubjectId: string,
    nationalSeriesId?: string | null
  ): Promise<number | null> => {
    const entry = await db.query.nationalCurriculum.findFirst({
      where: and(
        eq(nationalCurriculum.nationalLevelId, nationalLevelId),
        eq(nationalCurriculum.nationalSubjectId, nationalSubjectId),
        nationalSeriesId
          ? eq(nationalCurriculum.nationalSeriesId, nationalSeriesId)
          : undefined
      ),
    });
    return entry ? Number(entry.coefficient) : null;
  },

  /** Active/désactive un niveau pour une école (jamais de suppression du référentiel national). */
  toggleSchoolLevel: async (db: DB, schoolId: string, levelId: string, isActive: boolean) => {
    const [updated] = await db
      .update(levels)
      .set({ isActive })
      .where(and(eq(levels.id, levelId), eq(levels.schoolId, schoolId)))
      .returning();
    return updated;
  },

  /** Active/désactive une matière pour une école. */
  toggleSchoolSubject: async (db: DB, schoolId: string, subjectId: string, isActive: boolean) => {
    const [updated] = await db
      .update(subjects)
      .set({ isActive })
      .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId)))
      .returning();
    return updated;
  },
};
