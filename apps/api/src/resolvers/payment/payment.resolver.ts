import { eq, and, inArray, count, or } from 'drizzle-orm';
import { payments, paymentTransactions, notifications, students, parentStudents, schoolMemberships, classes } from '../../db/schema';
import { requireSchoolMember, requireSchoolAdmin, requireStudentAccess } from '../../middleware/permissions';
import {
  UpdatePaymentStatusSchema, RecordManualPaymentSchema,
  CancelPaymentTransactionSchema, InitiateRemotePaymentSchema,
} from '../../utils/validators/schemas';
import { paymentService } from '../../services/payment.service';
import { remotePaymentGateway } from '../../services/remote-payment-gateway.service';
import { pubsub }       from '../../pubsub';
import { auditService } from '../../services/audit.service';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../middleware/auth';

/** Dérive l'école à partir de l'élève ciblé, en toute sécurité multi-tenant. */
async function resolveTargetSchoolId(ctx: GraphQLContext, studentId: string) {
  const targetStudent = await ctx.db.query.students.findFirst({
    where: eq(students.id, studentId),
    with: { class: true },
  });
  if (!targetStudent) {
    throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
  }
  return { targetStudent, schoolId: (targetStudent as any).class.schoolId as string };
}

export const paymentResolvers = {
  Query: {
    paymentsByStudent: async (
      _: unknown,
      args: { studentId: string; anneeScolaire: string },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') ne vérifiait QUE l'authentification.
      // N'importe quel utilisateur connecté (même d'une autre école) pouvait
      // consulter les paiements de n'importe quel élève. Corrigé ci-dessous.
      const { schoolId } = await resolveTargetSchoolId(ctx, args.studentId);
      await requireStudentAccess(ctx, args.studentId, schoolId);
      return paymentService.getPaymentSummary(ctx.db, args.studentId, args.anneeScolaire);
    },

    unpaidStudents: async (
      _: unknown,
      args: { schoolId: string; anneeScolaire: string; mois: number },
      ctx: GraphQLContext
    ) => {
      // Avant : `args.schoolId` n'était jamais utilisé dans la requête —
      // un admin d'une école pouvait donc voir les élèves impayés de
      // TOUTES les écoles de la plateforme. Corrigé : on scope désormais
      // explicitement sur les élèves de l'école demandée, et on vérifie
      // que l'appelant est bien admin de CETTE école (pas d'une autre).
      requireSchoolAdmin(ctx, args.schoolId);

      const schoolClassIds = await ctx.db.query.classes.findMany({
        where: eq(classes.schoolId, args.schoolId),
        columns: { id: true },
      });
      if (schoolClassIds.length === 0) return [];
      const schoolStudentIds = await ctx.db.query.students.findMany({
        where: inArray(students.classId, schoolClassIds.map((c) => c.id)),
        columns: { id: true },
      });
      if (schoolStudentIds.length === 0) return [];

      // Trouver les paiements impayés de ce mois, pour cette école uniquement
      const unpaid = await ctx.db.query.payments.findMany({
        where: and(
          eq(payments.mois,          args.mois),
          eq(payments.anneeScolaire, args.anneeScolaire),
          or(eq(payments.statut, 'IMPAYE'), eq(payments.statut, 'PARTIEL')),
          inArray(payments.studentId, schoolStudentIds.map((s) => s.id)),
        ),
        with: {
          student: {
            with: {
              membership: { with: { profile: true } },
              class: true,
            },
          },
        },
      });
      return unpaid.map((p: any) => p.student).filter(Boolean); // eslint-disable-line @typescript-eslint/no-explicit-any
    },

    paymentsByClass: async (
      _: unknown,
      args: { classId: string; anneeScolaire: string },
      ctx: GraphQLContext
    ) => {
      const targetClass = await ctx.db.query.classes.findFirst({
        where: eq(classes.id, args.classId),
      });
      if (!targetClass) {
        throw new GraphQLError('Classe introuvable.', { extensions: { code: 'NOT_FOUND' } });
      }
      // Liste des paiements de toute une classe : réservé au staff de
      // l'école (admin/enseignant), pas à un parent ou un élève isolé.
      const user = requireSchoolMember(ctx, targetClass.schoolId);
      if (!['ADMIN', 'SUPER_ADMIN', 'TEACHER'].includes(user.role)) {
        throw new GraphQLError('Accès refusé — permissions insuffisantes.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const classStudents = await ctx.db.query.students.findMany({
        where: eq(students.classId, args.classId),
        columns: { id: true },
      });

      return Promise.all(
        classStudents.map((s) =>
          paymentService.getPaymentSummary(ctx.db, s.id, args.anneeScolaire)
        )
      );
    },

    paymentTransactionHistory: async (
      _: unknown,
      args: { studentId: string; anneeScolaire?: string },
      ctx: GraphQLContext
    ) => {
      const { schoolId } = await resolveTargetSchoolId(ctx, args.studentId);
      await requireStudentAccess(ctx, args.studentId, schoolId);
      return paymentService.getTransactionHistory(ctx.db, args.studentId, args.anneeScolaire);
    },
  },

  Mutation: {
    updatePaymentStatus: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = UpdatePaymentStatusSchema.parse(args.input);

      // Dérive l'école depuis l'élève ciblé (au lieu de forcer `user.schoolId!`,
      // qui bloquait un SUPER_ADMIN non rattaché à une école).
      const targetStudent = await ctx.db.query.students.findFirst({
        where: eq(students.id, input.studentId),
        with: { class: true },
      });
      if (!targetStudent) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const targetSchoolId = (targetStudent as any).class.schoolId;
      const user = requireSchoolAdmin(ctx, targetSchoolId);

      const updated = [];

      for (const mois of input.mois) {
        // Upsert du statut pour ce mois
        const existing = await ctx.db.query.payments.findFirst({
          where: and(
            eq(payments.studentId,     input.studentId),
            eq(payments.mois,          mois),
            eq(payments.anneeScolaire, input.anneeScolaire),
          ),
        });

        let result;
        const existingPayment = existing ?? (await paymentService.getOrCreatePayment(
          ctx.db, input.studentId, mois, input.anneeScolaire
        ));

        if (input.statut === 'EXONERE') {
          const [u] = await ctx.db
            .update(payments)
            .set({
              statut:      'EXONERE',
              updatedById: user.membershipId!,
              updatedAt:   new Date(),
            })
            .where(eq(payments.id, existingPayment.id))
            .returning();
          result = u;
        } else if (input.statut === 'PAYE') {
          const due = Number(existingPayment.montantDu) || 0;
          const paid = Number(existingPayment.montantPaye) || 0;
          const remaining = Math.max(0, due - paid);
          if (remaining > 0) {
            const recorded = await paymentService.recordManualPayment(ctx.db, {
              studentId:     input.studentId,
              mois,
              anneeScolaire: input.anneeScolaire,
              montant:       remaining,
              mode:          'AUTRE',
              agentId:       user.membershipId!,
              observations:  'Soldé par l’administration',
            });
            result = recorded.payment;
          } else {
            result = existingPayment;
          }
        } else if (input.statut === 'IMPAYE') {
          if (Number(existingPayment.montantPaye) > 0) {
            throw new GraphQLError(
              'Impossible de repasser en impayé : des encaissements existent. Annulez les transactions.',
              { extensions: { code: 'BAD_USER_INPUT' } }
            );
          }
          const [u] = await ctx.db
            .update(payments)
            .set({
              statut:       'IMPAYE',
              datePaiement: null,
              updatedById:  user.membershipId!,
              updatedAt:    new Date(),
            })
            .where(eq(payments.id, existingPayment.id))
            .returning();
          result = u;
        } else {
          throw new GraphQLError(
            'Utilisez un encaissement au guichet pour un paiement partiel.',
            { extensions: { code: 'BAD_USER_INPUT' } }
          );
        }
        if (!result) continue;
        updated.push(result);

        await auditService.log(ctx.db, {
          schoolId:    targetSchoolId,
          actorId:     user.membershipId,
          action:      'PAYMENT_UPDATED',
          entityType:  'payment',
          entityId:    result.id,
          oldValue:    existing ? { statut: existing.statut } : undefined,
          newValue:    { statut: input.statut, mois },
          description: `Paiement mois ${mois} → ${input.statut}`,
        });
      }

      // Notifier le parent si PAYE
      if (input.statut === 'PAYE') {
        const parentLinks = await ctx.db.query.parentStudents.findMany({
          where: eq(parentStudents.studentId, input.studentId),
          with: {
            parent:  { with: { profile: true } },
            student: { with: { membership: { with: { profile: true } } } },
          },
        });

        const notifValues = parentLinks.map((link: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const studentName = `${link.student.membership.profile.prenom} ${link.student.membership.profile.nom}`;
          const moisLabel   = input.mois.length === 1
            ? `mois ${input.mois[0]}`
            : `mois ${input.mois.join(', ')}`;
          return {
            profileId: link.parent.profile.id,
            schoolId:  targetSchoolId,
            titre:     '✅ Paiement enregistré',
            message:   `Le paiement de ${studentName} pour le ${moisLabel} (${input.anneeScolaire}) a bien été enregistré.`,
            type:      'PAIEMENT' as const,
          };
        });

        if (notifValues.length > 0) {
          await ctx.db.insert(notifications).values(notifValues);
        }
      }

      // Notifier via subscription
      pubsub.publish('PAYMENT_STATUS', input.studentId, {
        paymentStatusChanged: updated[updated.length - 1],
      });

      return updated;
    },

    // ── Paiement en présentiel (guichet) ──────────────────────
    recordManualPayment: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = RecordManualPaymentSchema.parse(args.input);
      const { schoolId } = await resolveTargetSchoolId(ctx, input.studentId);
      const user = requireSchoolAdmin(ctx, schoolId);

      const { transaction, payment } = await paymentService.recordManualPayment(ctx.db, {
        ...input,
        agentId: user.membershipId!,
      });

      await auditService.log(ctx.db, {
        schoolId,
        actorId:    user.membershipId,
        action:     'PAYMENT_TRANSACTION_CREATED',
        entityType: 'payment_transaction',
        entityId:   transaction.id,
        newValue:   { montant: input.montant, mode: input.mode, mois: input.mois },
        description: `Encaissement guichet de ${input.montant} XAF (${input.mode}) — mois ${input.mois}`,
      });

      // Notifier le parent si la mensualité est désormais soldée
      if (payment && (payment.statut === 'PAYE' || payment.statut === 'PARTIEL')) {
        const parentLinks = await ctx.db.query.parentStudents.findMany({
          where: eq(parentStudents.studentId, input.studentId),
          with: { parent: { with: { profile: true } } },
        });
        const notifValues = parentLinks.map((link: any) => ({
          profileId: link.parent.profile.id,
          schoolId,
          titre:   payment.statut === 'PAYE' ? '✅ Paiement enregistré' : '💰 Paiement partiel enregistré',
          message: `Un versement de ${input.montant} XAF a été enregistré pour le mois ${input.mois} (${input.anneeScolaire}).`,
          type:    'PAIEMENT' as const,
        }));
        if (notifValues.length > 0) await ctx.db.insert(notifications).values(notifValues);
      }

      if (payment) {
        pubsub.publish('PAYMENT_STATUS', input.studentId, { paymentStatusChanged: [payment] });
      }

      return { transaction, payment };
    },

    cancelPaymentTransaction: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = CancelPaymentTransactionSchema.parse(args.input);

      const original = await ctx.db.query.paymentTransactions.findFirst({
        where: eq(paymentTransactions.id, input.transactionId),
      });
      if (!original) {
        throw new GraphQLError('Transaction introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const { schoolId } = await resolveTargetSchoolId(ctx, original.studentId);
      const user = requireSchoolAdmin(ctx, schoolId);

      const { reversal, payment } = await paymentService.cancelTransaction(ctx.db, {
        transactionId: input.transactionId,
        actorId:       user.membershipId!,
        observations:  input.observations,
      });

      await auditService.log(ctx.db, {
        schoolId,
        actorId:    user.membershipId,
        action:     'PAYMENT_TRANSACTION_CANCELLED',
        entityType: 'payment_transaction',
        entityId:   reversal.id,
        oldValue:   { transactionAnnulee: original.id, montant: original.montant },
        description: input.observations ?? `Annulation de la transaction ${original.numeroRecu ?? original.id}`,
      });

      if (payment) {
        pubsub.publish('PAYMENT_STATUS', original.studentId, { paymentStatusChanged: [payment] });
      }

      return { transaction: reversal, payment };
    },

    // ── Paiement à distance simulé (Mobile Money, XAF) ────────
    initiateRemotePayment: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = InitiateRemotePaymentSchema.parse(args.input);
      const { schoolId } = await resolveTargetSchoolId(ctx, input.studentId);
      // Avant : requireSchoolMember(ctx, schoolId) autorisait N'IMPORTE QUEL
      // membre de l'école à payer pour N'IMPORTE QUEL élève de cette école
      // (un enseignant, voire un autre parent, aurait pu déclencher un
      // paiement pour un élève qui n'est pas le sien). Corrigé : seul le
      // parent réellement rattaché à cet élève, l'élève lui-même, ou un
      // membre du staff (admin/enseignant) peut désormais le faire.
      await requireStudentAccess(ctx, input.studentId, schoolId);

      const existing = await paymentService.getOrCreatePayment(
        ctx.db, input.studentId, input.mois, input.anneeScolaire
      );
      const remaining = Math.max(0, Number(existing.montantDu) - Number(existing.montantPaye));
      if (remaining <= 0) {
        throw new GraphQLError('Cette mensualité est déjà soldée.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      const montant = input.montant > 0 ? Math.min(input.montant, remaining) : remaining;

      const { transaction, payment } = await remotePaymentGateway.initiateRemotePayment(ctx.db, {
        studentId:       input.studentId,
        mois:            input.mois,
        anneeScolaire:   input.anneeScolaire,
        montant,
        numeroTelephone: input.numeroTelephone,
        schoolId,
      });

      if (payment) {
        pubsub.publish('PAYMENT_STATUS', input.studentId, { paymentStatusChanged: [payment] });
      }
      pubsub.publish('REMOTE_PAYMENT_STATUS', transaction.id, {
        remotePaymentStatusChanged: transaction,
      });

      return { transaction, payment };
    },
  },

  PaymentSummary: {
    student: async (
      parent: { student?: unknown; studentId?: string },
      _: unknown,
      ctx: GraphQLContext
    ) => {
      if (parent.student && typeof parent.student === 'object' && 'membership' in (parent.student as object)) {
        return parent.student;
      }
      const id = (parent.student as { id?: string } | undefined)?.id ?? parent.studentId;
      if (!id) return null;
      return ctx.db.query.students.findFirst({
        where: eq(students.id, id),
        with: { membership: { with: { profile: true } }, class: true },
      });
    },
  },

  Payment: {
    recuUrl: (payment: { statut?: string; id?: string }) =>
      payment.id && ['PAYE', 'EXONERE'].includes(payment.statut ?? '')
        ? `/pdf/recu/${payment.id}`
        : null,
    montantDu: (payment: { montantDu?: unknown }) => Number(payment.montantDu ?? 0),
    montantPaye: (payment: { montantPaye?: unknown }) => Number(payment.montantPaye ?? 0),
    datePaiement: (payment: { datePaiement?: Date | string | null }) => {
      if (!payment.datePaiement) return null;
      return payment.datePaiement instanceof Date
        ? payment.datePaiement.toISOString()
        : String(payment.datePaiement);
    },
    student: async (
      parent: { student?: unknown; studentId?: string },
      _: unknown,
      ctx: GraphQLContext
    ) => {
      if (parent.student) return parent.student;
      if (!parent.studentId) return null;
      return ctx.db.query.students.findFirst({
        where: eq(students.id, parent.studentId),
        with: { membership: { with: { profile: true } }, class: true },
      });
    },
    transactions: async (
      parent: { id?: string; transactions?: unknown[] },
      _: unknown,
      ctx: GraphQLContext
    ) => {
      if (parent.transactions) return parent.transactions;
      if (!parent.id) return [];
      return ctx.db.query.paymentTransactions.findMany({
        where: eq(paymentTransactions.paymentId, parent.id),
      });
    },
  },

  PaymentTransaction: {
    recuUrl: (tx: { statut?: string; paymentId?: string }) =>
      tx.statut === 'VALIDEE' && tx.paymentId ? `/pdf/recu/${tx.paymentId}` : null,
    payment: async (
      parent: { payment?: unknown; paymentId?: string },
      _: unknown,
      ctx: GraphQLContext
    ) => {
      if (parent.payment) return parent.payment;
      if (!parent.paymentId) return null;
      return ctx.db.query.payments.findFirst({ where: eq(payments.id, parent.paymentId) });
    },
    student: async (
      parent: { student?: unknown; studentId?: string },
      _: unknown,
      ctx: GraphQLContext
    ) => {
      if (parent.student) return parent.student;
      if (!parent.studentId) return null;
      return ctx.db.query.students.findFirst({
        where: eq(students.id, parent.studentId),
        with: { membership: { with: { profile: true } }, class: true },
      });
    },
  },
};
