import cron from 'node-cron';
import { db } from '../db';
import { schools, schoolMemberships, globalProfiles, students, bulletins, classes } from '../db/schema';
import { paymentService } from '../services/payment.service';
import { emailService } from '../services/email.service';
import { eq, and, count, sql } from 'drizzle-orm';

/**
 * Initialise tous les cron jobs du système
 */
export function initCronJobs(): void {
  // ── Rappel paiement mensuel ──────────────────────────────────
  // Tous les 1er du mois à 08h00
  cron.schedule('0 8 1 * *', async () => {
    console.log('[CRON] Déclenchement rappels paiements mensuels...');
    await runPaymentReminders();
  });

  // ── Rappel bulletin fin de trimestre ────────────────────────
  // Le 1er juin (fin T2) et le 1er octobre (fin T3/début T1)
  cron.schedule('0 9 1 6,10 *', async () => {
    console.log('[CRON] Rappel génération bulletins...');
    await runBulletinReminders();
  });

  console.log('[CRON] Jobs initialisés ✅');
}

async function runPaymentReminders(): Promise<void> {
  try {
    const now          = new Date();
    const moisCourant  = now.getMonth() + 1; // 1-12
    const moisScolaire = getMoisScolaire(moisCourant);

    if (moisScolaire < 1 || moisScolaire > 9) {
      console.log('[CRON] Hors période scolaire, pas de rappel.');
      return;
    }

    // Récupérer toutes les écoles actives
    const activeSchools = await db.query.schools.findMany({
      where: eq(schools.isActive, true),
    });

    for (const school of activeSchools) {
      const annee = school.anneeScolaire;
      await paymentService.sendMonthlyReminders(
        db,
        school.id,
        moisScolaire,
        annee
      );
    }
  } catch (error) {
    console.error('[CRON] Erreur rappels paiements:', error);
  }
}

async function runBulletinReminders(): Promise<void> {
  try {
    const now   = new Date();
    const month = now.getMonth() + 1; // 1-12
    // T1 ends ~Jan (month 1), T2 ends ~April (month 4), T3 ends ~June (month 6)
    const trimestre = month <= 1 ? 'T1' : month <= 4 ? 'T2' : 'T3';

    const activeSchools = await db.query.schools.findMany({
      where: eq(schools.isActive, true),
    });

    for (const school of activeSchools) {
      // Count students with no bulletin for current trimestre
      const [{ count: totalStudents }] = await db
        .select({ count: count() })
        .from(schoolMemberships)
        .where(and(eq(schoolMemberships.schoolId, school.id), eq(schoolMemberships.role, 'STUDENT')));

      const [{ count: withBulletin }] = await db
        .select({ count: count() })
        .from(bulletins)
        .where(and(
          eq(bulletins.trimestre, trimestre),
          sql`${bulletins.studentId} IN (
            SELECT s.id FROM students s
            JOIN school_memberships m ON s.membership_id = m.id
            WHERE m.school_id = ${school.id}
          )`
        ));

      const pending = Number(totalStudents) - Number(withBulletin);
      if (pending <= 0) continue;

      // Find admins for this school
      const admins = await db.query.schoolMemberships.findMany({
        where: and(eq(schoolMemberships.schoolId, school.id), eq(schoolMemberships.role, 'ADMIN')),
        with: { profile: true },
      });

      for (const admin of admins) {
        if (!admin.profile?.email) continue;
        await emailService.sendBulletinGenerationReminder({
          to:           admin.profile.email,
          adminPrenom:  admin.profile.prenom,
          schoolName:   school.nom,
          trimestre,
          anneeScolaire: school.anneeScolaire,
          pendingCount:  pending,
        }).catch((err) => console.error('[CRON] Erreur email bulletin reminder:', err));
      }

      console.log(`[CRON] Rappel bulletins envoyé — ${school.nom} — ${pending} bulletins manquants (${trimestre})`);
    }
  } catch (error) {
    console.error('[CRON] Erreur rappel bulletins:', error);
  }
}

/**
 * Convertit le mois calendaire en mois scolaire (Sept=1 ... Mai=9)
 */
function getMoisScolaire(moisCalendaire: number): number {
  // Sept=1, Oct=2, Nov=3, Déc=4, Jan=5, Fév=6, Mar=7, Avr=8, Mai=9
  const map: Record<number, number> = {
    9: 1, 10: 2, 11: 3, 12: 4,
    1: 5,  2: 6,  3: 7,  4: 8,  5: 9,
  };
  return map[moisCalendaire] ?? 0;
}
