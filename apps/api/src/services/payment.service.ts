import { eq, and, inArray, sql } from 'drizzle-orm';
import { emailService } from './email.service';
import {
  payments, paymentTransactions, bulletins, notifications, students,
  schoolMemberships, globalProfiles, parentStudents,
} from '../db/schema';
import { generateNumeroRecu, generateTransactionRef } from '../utils/code-generator';
import type { DB } from '../db';

export type MontantDu = number;

// Montant de scolarité par défaut (FCFA) appliqué à une mensualité qui n'a pas
// encore de montantDu explicite. À terme ce montant devrait venir d'une grille
// tarifaire par école/niveau — c'est un point d'extension volontairement isolé
// ici pour ne pas figer une valeur en dur ailleurs dans le code.
export const DEFAULT_MONTANT_MENSUALITE = 25000;

/** Recalcule montantPaye + statut d'une mensualité à partir de son journal de transactions. */
async function recomputePaymentAggregate(db: DB, paymentId: string) {
  const txs = await db.query.paymentTransactions.findMany({
    where: eq(paymentTransactions.paymentId, paymentId),
  });

  const totalValide = txs
    .filter((t) => t.statut === 'VALIDEE')
    .reduce((sum, t) => sum + Number(t.montant), 0);

  // Les reversals (statut ANNULEE avec annuleTransactionId renseigné) viennent
  // en déduction — la transaction d'origine reste inchangée pour l'historique.
  const totalAnnule = txs
    .filter((t) => t.statut === 'ANNULEE' && t.annuleTransactionId)
    .reduce((sum, t) => sum + Number(t.montant), 0);

  const montantPaye = Math.max(0, totalValide - totalAnnule);

  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment) return null;

  // EXONERE reste un statut administratif indépendant du montant réellement encaissé.
  let statut: typeof payments.$inferSelect.statut = payment.statut;
  if (payment.statut !== 'EXONERE') {
    const due = Number(payment.montantDu);
    if (montantPaye <= 0) statut = 'IMPAYE';
    else if (due > 0 && montantPaye >= due) statut = 'PAYE';
    else statut = 'PARTIEL';
  }

  const [updated] = await db
    .update(payments)
    .set({
      montantPaye: montantPaye.toFixed(2),
      statut,
      datePaiement: statut === 'PAYE' ? new Date() : payment.datePaiement,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId))
    .returning();

  return updated;
}

// Mois par trimestre
export const TRIMESTER_MONTHS: Record<string, number[]> = {
  T1: [1, 2, 3],
  T2: [4, 5, 6],
  T3: [7, 8, 9],
};

export const paymentService = {
  /**
   * Vérifie si le bulletin d'un trimestre est déverrouillé pour un élève
   * Règle : tous les mois du trimestre doivent être PAYE ou EXONERE
   */
  isBulletinUnlocked: async (
    db: DB,
    studentId: string,
    trimestre: 'T1' | 'T2' | 'T3',
    anneeScolaire: string
  ): Promise<boolean> => {
    const mois = TRIMESTER_MONTHS[trimestre];
    const studentPayments = await db.query.payments.findMany({
      where: and(
        eq(payments.studentId, studentId),
        eq(payments.anneeScolaire, anneeScolaire),
        inArray(payments.mois, mois)
      ),
    });

    if (studentPayments.length < mois.length) return false;

    return studentPayments.every(
      (p) => p.statut === 'PAYE' || p.statut === 'EXONERE'
    );
  },

  /**
   * Initialise les 9 mois de paiement pour un nouvel élève
   */
  initializePayments: async (
    db: DB,
    studentId: string,
    anneeScolaire: string,
    montantMensualite: number = DEFAULT_MONTANT_MENSUALITE
  ): Promise<void> => {
    const records = Array.from({ length: 9 }, (_, i) => ({
      studentId,
      mois:          i + 1,
      anneeScolaire,
      statut:        'IMPAYE' as const,
      montantDu:     montantMensualite.toFixed(2),
      montantPaye:   '0',
    }));
    await db.insert(payments).values(records);
  },

  /**
   * Résumé des paiements d'un élève pour une année scolaire
   */
  getPaymentSummary: async (
    db: DB,
    studentId: string,
    anneeScolaire: string
  ) => {
    const allPayments = await db.query.payments.findMany({
      where: and(
        eq(payments.studentId, studentId),
        eq(payments.anneeScolaire, anneeScolaire)
      ),
      orderBy: (p, { asc }) => [asc(p.mois)],
    });

    const existingMois = new Set(allPayments.map((p) => p.mois));
    const missingMois = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((m) => !existingMois.has(m));
    if (missingMois.length > 0) {
      await db.insert(payments).values(
        missingMois.map((mois) => ({
          studentId,
          mois,
          anneeScolaire,
          statut:      'IMPAYE' as const,
          montantDu:   DEFAULT_MONTANT_MENSUALITE.toFixed(2),
          montantPaye: '0',
        }))
      ).onConflictDoNothing();
    }

    const moisDetails = missingMois.length === 0
      ? allPayments
      : await db.query.payments.findMany({
          where: and(
            eq(payments.studentId, studentId),
            eq(payments.anneeScolaire, anneeScolaire)
          ),
          orderBy: (p, { asc }) => [asc(p.mois)],
        });

    const isUnlocked = async (t: 'T1' | 'T2' | 'T3') => {
      const mois = TRIMESTER_MONTHS[t];
      const tPayments = moisDetails.filter((p) => mois.includes(p.mois));
      return (
        tPayments.length === mois.length &&
        tPayments.every((p) => p.statut === 'PAYE' || p.statut === 'EXONERE')
      );
    };

    const [t1Unlocked, t2Unlocked, t3Unlocked] = await Promise.all([
      isUnlocked('T1'),
      isUnlocked('T2'),
      isUnlocked('T3'),
    ]);

    return {
      studentId,
      // GraphQL PaymentSummary.student est non-null : sans cet objet la requête
      // paymentsByStudent échoue entièrement (liste vide côté parent, montant 0).
      student: { id: studentId },
      anneeScolaire,
      moisDetails,
      t1Unlocked,
      t2Unlocked,
      t3Unlocked,
      totalPaid:    moisDetails.filter((p) => p.statut === 'PAYE' || p.statut === 'EXONERE').length,
      totalUnpaid:  moisDetails.filter((p) => p.statut === 'IMPAYE' || p.statut === 'PARTIEL').length,
    };
  },

  /**
   * Envoie des notifications de rappel de paiement pour tous les élèves impayés
   * Appelé par le cron job mensuel
   */
  sendMonthlyReminders: async (
    db: DB,
    schoolId: string,
    moisCourant: number,
    anneeScolaire: string
  ): Promise<void> => {
    // Trouver tous les paiements impayés du mois courant
    const unpaidPayments = await db.query.payments.findMany({
      where: and(
        eq(payments.mois, moisCourant),
        eq(payments.anneeScolaire, anneeScolaire),
        eq(payments.statut, 'IMPAYE')
      ),
      with: {
        student: {
          with: {
            membership: { with: { profile: true } },
            parents: { with: { parent: { with: { profile: true } } } },
          },
        },
      },
    });

    const notificationValues = [];

    for (const payment of unpaidPayments) {
      const student = (payment as any).student;
      const studentName = `${student.membership.profile.prenom} ${student.membership.profile.nom}`;

      // Notifier chaque parent
      for (const parentLink of student.parents) {
        notificationValues.push({
          profileId: parentLink.parent.profile.id,
          schoolId,
          titre:   `💰 Mensualité impayée — Mois ${moisCourant}`,
          message: `La mensualité de ${studentName} pour le mois ${moisCourant} de l'année ${anneeScolaire} n'a pas encore été réglée. Veuillez vous rapprocher de l'administration.`,
          type:    'PAIEMENT' as const,
        });
      }
    }

    if (notificationValues.length > 0) {
      await db.insert(notifications).values(notificationValues);
    }

    // Envoyer emails aux parents (non bloquant)
    for (const payment of unpaidPayments) {
      const student = (payment as any).student;
      for (const parentLink of student.parents) {
        const parentProfile = parentLink.parent.profile;
        if (parentProfile?.email) {
          const school = await db.query.schools.findFirst({
            where: (s, { eq }) => eq(s.id, schoolId),
          });
          const moisLabels = ['Janvier','Février','Mars','Avril','Mai','Juin',
            'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
          emailService.sendPaymentReminder({
            to:            parentProfile.email,
            parentPrenom:  parentProfile.prenom ?? 'Parent',
            studentPrenom: `${student.membership.profile.prenom} ${student.membership.profile.nom}`,
            moisLabel:     moisLabels[moisCourant - 1] ?? `Mois ${moisCourant}`,
            schoolName:    school?.nom ?? 'sulungukutu',
          }).catch((err) => console.error('[Email paiement]', err));
        }
      }
    }

    console.log(`[PaymentService] ${unpaidPayments.length} rappels envoyés pour le mois ${moisCourant}`);
  },

  /**
   * Récupère (ou crée avec montantDu par défaut) la mensualité ciblée.
   */
  getOrCreatePayment: async (
    db: DB,
    studentId: string,
    mois: number,
    anneeScolaire: string
  ) => {
    const existing = await db.query.payments.findFirst({
      where: and(
        eq(payments.studentId, studentId),
        eq(payments.mois, mois),
        eq(payments.anneeScolaire, anneeScolaire)
      ),
    });
    if (existing) return existing;

    const [created] = await db
      .insert(payments)
      .values({
        studentId,
        mois,
        anneeScolaire,
        statut: 'IMPAYE',
        montantDu: DEFAULT_MONTANT_MENSUALITE.toFixed(2),
        montantPaye: '0',
      })
      .returning();
    return created;
  },

  /**
   * Enregistre un paiement effectué en présentiel (guichet) : espèces ou tout
   * autre mode local. Crée une transaction VALIDEE immédiatement (contrairement
   * au paiement à distance qui passe par un statut EN_ATTENTE), génère le
   * numéro de reçu, et recalcule le solde de l'élève pour ce mois.
   */
  recordManualPayment: async (
    db: DB,
    input: {
      studentId: string;
      mois: number;
      anneeScolaire: string;
      montant: number;
      mode: 'ESPECES' | 'VIREMENT' | 'CHEQUE' | 'AUTRE';
      agentId: string;
      observations?: string;
    }
  ) => {
    const payment = await paymentService.getOrCreatePayment(
      db, input.studentId, input.mois, input.anneeScolaire
    );

    const [transaction] = await db
      .insert(paymentTransactions)
      .values({
        paymentId:      payment.id,
        studentId:      input.studentId,
        montant:        input.montant.toFixed(2),
        mode:           input.mode,
        canal:          'GUICHET',
        statut:         'VALIDEE',
        numeroRecu:     generateNumeroRecu(input.anneeScolaire),
        transactionRef: generateTransactionRef(),
        agentId:        input.agentId,
        observations:   input.observations,
      })
      .returning();

    const updatedPayment = await recomputePaymentAggregate(db, payment.id);

    return { transaction, payment: updatedPayment };
  },

  /**
   * Annule une transaction VALIDEE en créant une écriture de reversal
   * (jamais de suppression / mutation de l'historique original).
   */
  cancelTransaction: async (
    db: DB,
    input: { transactionId: string; actorId: string; observations?: string }
  ) => {
    const original = await db.query.paymentTransactions.findFirst({
      where: eq(paymentTransactions.id, input.transactionId),
    });
    if (!original) {
      throw new Error('Transaction introuvable');
    }
    if (original.statut !== 'VALIDEE') {
      throw new Error('Seule une transaction validée peut être annulée');
    }

    const alreadyReversed = await db.query.paymentTransactions.findFirst({
      where: and(
        eq(paymentTransactions.annuleTransactionId, original.id),
        eq(paymentTransactions.statut, 'ANNULEE'),
      ),
    });
    if (alreadyReversed) {
      throw new Error('Cette transaction a déjà été annulée');
    }

    const [reversal] = await db
      .insert(paymentTransactions)
      .values({
        paymentId:           original.paymentId,
        studentId:           original.studentId,
        montant:             original.montant,
        mode:                original.mode,
        canal:               original.canal,
        statut:              'ANNULEE',
        transactionRef:      generateTransactionRef(),
        agentId:             input.actorId,
        observations:        input.observations ?? `Annulation de la transaction ${original.numeroRecu ?? original.id}`,
        annuleTransactionId: original.id,
      })
      .returning();

    const updatedPayment = await recomputePaymentAggregate(db, original.paymentId);

    return { reversal, payment: updatedPayment };
  },

  /**
   * Historique complet des transactions d'un élève (tous mois confondus, ou filtré).
   */
  getTransactionHistory: async (
    db: DB,
    studentId: string,
    anneeScolaire?: string
  ) => {
    const paymentIds = await db.query.payments.findMany({
      where: anneeScolaire
        ? and(eq(payments.studentId, studentId), eq(payments.anneeScolaire, anneeScolaire))
        : eq(payments.studentId, studentId),
      columns: { id: true },
    });
    const ids = paymentIds.map((p) => p.id);
    if (ids.length === 0) return [];

    return db.query.paymentTransactions.findMany({
      where: inArray(paymentTransactions.paymentId, ids),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      with: { agent: { with: { profile: true } } },
    });
  },
};

export { recomputePaymentAggregate };

