import { eq, and, avg, inArray } from 'drizzle-orm';
import {
  bulletins,
  bulletinDetails,
  grades,
  classSubjects,
  students,
  notifications,
  parentStudents,
  schoolMemberships,
  globalProfiles,
  classes,
} from '../db/schema';
import { paymentService } from './payment.service';
import type { DB } from '../db';

type Trimester = 'T1' | 'T2' | 'T3';

interface BulletinGenerationResult {
  generated: number;
  errors:    string[];
}

export const bulletinService = {
  /**
   * Génère les bulletins pour toute une classe
   */
  generateForClass: async (
    db: DB,
    classId: string,
    trimestre: Trimester,
    anneeScolaire: string
  ): Promise<BulletinGenerationResult> => {
    const result: BulletinGenerationResult = { generated: 0, errors: [] };

    // Récupérer tous les élèves de la classe
    const classStudents = await db.query.students.findMany({
      where: eq(students.classId, classId),
    });

    // Récupérer les matières de la classe
    const classSubs = await db.query.classSubjects.findMany({
      where: eq(classSubjects.classId, classId),
      with:  { subject: true },
    });

    if (classSubs.length === 0) {
      result.errors.push('Aucune matière assignée à cette classe');
      return result;
    }

    // Calculer les moyennes pour chaque élève
    const studentAverages: Array<{ studentId: string; moyenneGenerale: number }> = [];

    for (const student of classStudents) {
      try {
        const bulletin = await bulletinService.generateForStudent(
          db,
          student.id,
          classId,
          classSubs,
          trimestre,
          anneeScolaire
        );
        if (bulletin) {
          studentAverages.push({
            studentId:       student.id,
            moyenneGenerale: Number(bulletin.moyenneGenerale),
          });
          result.generated++;
        }
      } catch (err) {
        result.errors.push(`Élève ${student.id}: ${(err as Error).message}`);
      }
    }

    // Calculer et mettre à jour les rangs
    studentAverages.sort((a, b) => b.moyenneGenerale - a.moyenneGenerale);
    for (let i = 0; i < studentAverages.length; i++) {
      await db
        .update(bulletins)
        .set({ rang: i + 1 })
        .where(
          and(
            eq(bulletins.studentId, studentAverages[i].studentId),
            eq(bulletins.trimestre, trimestre),
            eq(bulletins.anneeScolaire, anneeScolaire)
          )
        );
    }

    return result;
  },

  /**
   * Génère le bulletin d'un seul élève
   */
  generateForStudent: async (
    db: DB,
    studentId: string,
    classId: string,
    classSubs: any[],
    trimestre: Trimester,
    anneeScolaire: string
  ) => {
    // Supprimer l'ancien bulletin si existant
    await db
      .delete(bulletins)
      .where(
        and(
          eq(bulletins.studentId, studentId),
          eq(bulletins.trimestre, trimestre),
          eq(bulletins.anneeScolaire, anneeScolaire)
        )
      );

    let totalPoints      = 0;
    let totalCoefficient = 0;
    const details: typeof bulletinDetails.$inferInsert[] = [];

    for (const cs of classSubs) {
      // Calculer la moyenne de l'élève dans cette matière pour ce trimestre
      const studentGrades = await db.query.grades.findMany({
        where: and(
          eq(grades.studentId, studentId),
          eq(grades.classSubjectId, cs.id),
          eq(grades.trimestre, trimestre)
        ),
      });

      if (studentGrades.length === 0) continue;

      const sum     = studentGrades.reduce((acc, g) => acc + Number(g.valeur), 0);
      const moyenne = sum / studentGrades.length;
      const coef    = Number(cs.coefficient);
      const points  = moyenne * coef;

      totalPoints      += points;
      totalCoefficient += coef;

      details.push({
        bulletinId:     '', // sera rempli après insertion du bulletin
        classSubjectId: cs.id,
        moyenneMatiere: moyenne.toFixed(2) as unknown as string,
        coefficient:    cs.coefficient,
        pointsObtenus:  points.toFixed(2) as unknown as string,
        appreciation:   getAppreciation(moyenne),
      });
    }

    if (details.length === 0) return null;

    const moyenneGenerale = totalCoefficient > 0
      ? totalPoints / totalCoefficient
      : 0;

    const mention = getMention(moyenneGenerale);

    // Créer le bulletin
    const [newBulletin] = await db
      .insert(bulletins)
      .values({
        studentId,
        trimestre,
        anneeScolaire,
        statut:          'BROUILLON',
        moyenneGenerale: moyenneGenerale.toFixed(2) as unknown as string,
        mention,
        generatedAt:     new Date(),
      })
      .returning();

    // Créer les détails avec l'ID du bulletin
    const detailsWithId = details.map((d) => ({
      ...d,
      bulletinId: newBulletin.id,
    }));

    await db.insert(bulletinDetails).values(detailsWithId);

    return newBulletin;
  },
};

// ── Helpers ───────────────────────────────────────────────────

function getMention(moyenne: number): typeof bulletins.$inferInsert['mention'] {
  if (moyenne >= 16) return 'EXCELLENT';
  if (moyenne >= 14) return 'TRES_BIEN';
  if (moyenne >= 12) return 'BIEN';
  if (moyenne >= 10) return 'ASSEZ_BIEN';
  if (moyenne >= 8)  return 'PASSABLE';
  return 'INSUFFISANT';
}

function getAppreciation(moyenne: number): string {
  if (moyenne >= 16) return 'Excellent — Continuez ainsi !';
  if (moyenne >= 14) return 'Très bien — Bon travail';
  if (moyenne >= 12) return 'Bien — Des efforts encourageants';
  if (moyenne >= 10) return 'Assez bien — Peut mieux faire';
  if (moyenne >= 8)  return 'Passable — Des efforts sont nécessaires';
  return 'Insuffisant — Un travail sérieux s\'impose';
}
