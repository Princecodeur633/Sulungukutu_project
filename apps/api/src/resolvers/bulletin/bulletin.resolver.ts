import { and, eq, inArray, isNull } from 'drizzle-orm';
import { bulletins, notifications, parentStudents, students, classes, classSubjects } from '../../db/schema';
import { requireAdmin, requireSchoolMember, requireSchoolAdmin, requireAuth, requireStudentAccess } from '../../middleware/permissions';
import { GenerateBulletinsSchema } from '../../utils/validators/schemas';
import { bulletinService } from '../../services/bulletin.service';
import { paymentService } from '../../services/payment.service';
import { pubsub }       from '../../pubsub';
import { auditService } from '../../services/audit.service';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../middleware/auth';
import type { BulletinData, StudentData, ParentStudentData } from '../../types/domain';
import { emailService } from '../../services/email.service';

export const bulletinResolvers = {
  Query: {
    bulletinsByStudent: async (
      _: unknown,
      args: { studentId: string; anneeScolaire: string },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.studentId),
        with: { class: true },
      });
      if (!student) throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      await requireStudentAccess(ctx, args.studentId, (student as any).class.schoolId);
      return ctx.db.query.bulletins.findMany({
        where: and(
          eq(bulletins.studentId,     args.studentId),
          eq(bulletins.anneeScolaire, args.anneeScolaire),
          isNull(bulletins.deletedAt),
        ),
        orderBy: (b, { asc }) => [asc(b.trimestre)],
        with: {
          details: { with: { classSubject: { with: { subject: true } } } },
          student: { with: { membership: { with: { profile: true } }, class: true } },
        },
      });
    },

    bulletinById: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const bulletin = await ctx.db.query.bulletins.findFirst({
        where: eq(bulletins.id, args.id),
        with: { student: { with: { class: true } } },
      });
      if (!bulletin) throw new GraphQLError('Bulletin introuvable', { extensions: { code: 'NOT_FOUND' } });
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      await requireStudentAccess(ctx, bulletin.studentId, (bulletin.student as any).class.schoolId);
      return ctx.db.query.bulletins.findFirst({
        where: eq(bulletins.id, args.id),
        with: {
          details: { with: { classSubject: { with: { subject: true } } } },
          student: { with: { membership: { with: { profile: true } }, class: true } },
        },
      });
    },

    bulletinsByClass: async (
      _: unknown,
      args: { classId: string; trimestre: string; anneeScolaire: string },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      const targetClass = await ctx.db.query.classes.findFirst({ where: eq(classes.id, args.classId) });
      if (!targetClass) throw new GraphQLError('Classe introuvable', { extensions: { code: 'NOT_FOUND' } });
      requireSchoolMember(ctx, targetClass.schoolId);

      const classStudents = await ctx.db.query.students.findMany({
        where: eq(students.classId, args.classId),
        columns: { id: true },
      });

      const studentIds = classStudents.map((s) => s.id);
      if (studentIds.length === 0) return [];
      return ctx.db.query.bulletins.findMany({
        where: and(
          inArray(bulletins.studentId, studentIds),
          eq(bulletins.trimestre, args.trimestre as typeof bulletins.trimestre._.data),
          eq(bulletins.anneeScolaire, args.anneeScolaire),
          isNull(bulletins.deletedAt),
        ),
        with: {
          student: { with: { membership: { with: { profile: true } } } },
          details: { with: { classSubject: { with: { subject: true } } } },
        },
        orderBy: (b, { desc }) => [desc(b.rang)],
      });
    },
  },

  // Resolver champ calculé isDownloadable
  Bulletin: {
    isDownloadable: async (parent: BulletinData, _: unknown, ctx: GraphQLContext) => {
      if (parent.statut !== 'PUBLIE') return false;
      return paymentService.isBulletinUnlocked(
        ctx.db,
        parent.studentId,
        parent.trimestre,
        parent.anneeScolaire
      );
    },
  },

  Mutation: {
    generateBulletins: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const input = GenerateBulletinsSchema.parse(args.input);

      // Dérive l'école depuis la classe ciblée (au lieu de forcer `user.schoolId!`,
      // qui bloquait un SUPER_ADMIN non rattaché à une école).
      const targetClass = await ctx.db.query.classes.findFirst({ where: eq(classes.id, input.classId) });
      if (!targetClass) {
        throw new GraphQLError('Classe introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const user = requireSchoolAdmin(ctx, targetClass.schoolId);

      const result = await bulletinService.generateForClass(
        ctx.db,
        input.classId,
        input.trimestre as 'T1' | 'T2' | 'T3',
        input.anneeScolaire
      );

      await auditService.log(ctx.db, {
        schoolId:    targetClass.schoolId,
        actorId:     user.membershipId,
        action:      'BULLETIN_GENERATED',
        entityType:  'class',
        entityId:    input.classId,
        description: `${result.generated} bulletins générés (${input.trimestre} — ${input.anneeScolaire})`,
      });

      return ctx.db.query.bulletins.findMany({
        where: and(
          inArray(bulletins.studentId, result.studentIds.length > 0 ? result.studentIds : ['00000000-0000-0000-0000-000000000000']),
          eq(bulletins.trimestre, input.trimestre as typeof bulletins.trimestre._.data),
          eq(bulletins.anneeScolaire, input.anneeScolaire),
          isNull(bulletins.deletedAt),
        ),
        with: {
          student: { with: { membership: { with: { profile: true } } } },
          details: { with: { classSubject: { with: { subject: true } } } },
        },
      });
    },

    publishBulletin: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const target = await ctx.db.query.bulletins.findFirst({
        where: eq(bulletins.id, args.id),
        with: { student: { with: { class: true } } },
      });
      if (!target) throw new GraphQLError('Bulletin introuvable', { extensions: { code: 'NOT_FOUND' } });
      const targetSchoolId = (target as any).student.class.schoolId;
      const user = requireSchoolAdmin(ctx, targetSchoolId);

      const pdfUrl = `/pdf/bulletin/${args.id}`;
      const [updated] = await ctx.db
        .update(bulletins)
        .set({ statut: 'PUBLIE', pdfUrl, updatedAt: new Date() })
        .where(eq(bulletins.id, args.id))
        .returning();

      // Notifier parent et élève
      await notifyBulletinPublished(ctx, updated);

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'BULLETIN_PUBLISHED',
        entityType:  'bulletin',
        entityId:    args.id,
        description: `Bulletin publié (${updated.trimestre})`,
      });

      return updated;
    },

    generateBulletinPdf: async (_: unknown, args: { bulletinId: string }, ctx: GraphQLContext) => {
      const target = await ctx.db.query.bulletins.findFirst({
        where: eq(bulletins.id, args.bulletinId),
        with: { student: { with: { class: true } } },
      });
      if (!target) throw new GraphQLError('Bulletin introuvable', { extensions: { code: 'NOT_FOUND' } });
      const targetSchoolId = (target as any).student.class.schoolId;
      await requireStudentAccess(ctx, target.studentId, targetSchoolId);

      const pdfUrl = `/pdf/bulletin/${args.bulletinId}`;
      const [updated] = await ctx.db
        .update(bulletins)
        .set({ pdfUrl, updatedAt: new Date() })
        .where(eq(bulletins.id, args.bulletinId))
        .returning();
      return updated;
    },

    updateBulletin: async (
      _: unknown,
      args: { id: string; input: { statut?: string; pdfUrl?: string } },
      ctx: GraphQLContext
    ) => {
      const target = await ctx.db.query.bulletins.findFirst({
        where: eq(bulletins.id, args.id),
        with: { student: { with: { class: true } } },
      });
      if (!target) throw new GraphQLError('Bulletin introuvable', { extensions: { code: 'NOT_FOUND' } });
      const targetSchoolId = (target as any).student.class.schoolId;
      const user = requireSchoolAdmin(ctx, targetSchoolId);

      const [updated] = await ctx.db
        .update(bulletins)
        .set(args.input as Record<string, unknown>)
        .where(eq(bulletins.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'BULLETIN_UPDATED',
        entityType:  'bulletin',
        entityId:    args.id,
        description: 'Bulletin mis à jour',
      });

      return updated;
    },

    deleteBulletin: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const target = await ctx.db.query.bulletins.findFirst({
        where: eq(bulletins.id, args.id),
        with: { student: { with: { class: true } } },
      });
      if (!target) throw new GraphQLError('Bulletin introuvable', { extensions: { code: 'NOT_FOUND' } });
      const targetSchoolId = (target as any).student.class.schoolId;
      const user = requireSchoolAdmin(ctx, targetSchoolId);

      // Avant : DELETE physique. Corrigé : soft delete (distinct du statut
      // ARCHIVE, qui reste un état officiel du bulletin, pas une suppression).
      await ctx.db
        .update(bulletins)
        .set({ deletedAt: new Date() })
        .where(eq(bulletins.id, args.id));
      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'BULLETIN_DELETED',
        entityType:  'bulletin',
        entityId:    args.id,
        description: 'Bulletin désactivé (soft delete)',
      });
      return true;
    },

    archiveBulletin: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const target = await ctx.db.query.bulletins.findFirst({
        where: eq(bulletins.id, args.id),
        with: { student: { with: { class: true } } },
      });
      if (!target) throw new GraphQLError('Bulletin introuvable', { extensions: { code: 'NOT_FOUND' } });
      const targetSchoolId = (target as any).student.class.schoolId;
      const user = requireSchoolAdmin(ctx, targetSchoolId);

      const [updated] = await ctx.db
        .update(bulletins)
        .set({ statut: 'ARCHIVE', updatedAt: new Date() })
        .where(eq(bulletins.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'BULLETIN_ARCHIVED',
        entityType:  'bulletin',
        entityId:    args.id,
        description: `Bulletin archivé (${updated.trimestre})`,
      });
      return updated;
    },

    regenerateBulletin: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const old  = await ctx.db.query.bulletins.findFirst({
        where: eq(bulletins.id, args.id),
        with:  { student: { with: { class: true } } },
      });
      if (!old) throw new Error('Bulletin introuvable');
      const targetSchoolId = (old as any).student.class.schoolId;
      const user = requireSchoolAdmin(ctx, targetSchoolId);

      const classId = (old as BulletinData).student?.classId ?? "";
      const classSubs = await ctx.db.query.classSubjects.findMany({
        where: and(eq(classSubjects.classId, classId), isNull(classSubjects.deletedAt)),
        with: { subject: true },
      });
      await bulletinService.generateForStudent(
        ctx.db,
        old.studentId,
        classId,
        classSubs,
        old.trimestre as 'T1' | 'T2' | 'T3',
        old.anneeScolaire
      );
      await bulletinService.updateRanks(
        ctx.db,
        classId,
        old.trimestre as 'T1' | 'T2' | 'T3',
        old.anneeScolaire
      );

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'BULLETIN_GENERATED',
        entityType:  'bulletin',
        entityId:    old.studentId,
        description: `Bulletin régénéré (${old.trimestre})`,
      });

      return ctx.db.query.bulletins.findFirst({
        where: and(
          eq(bulletins.studentId,     old.studentId),
          eq(bulletins.trimestre,     old.trimestre),
          eq(bulletins.anneeScolaire, old.anneeScolaire),
        ),
        with: {
          details: { with: { classSubject: { with: { subject: true } } } },
          student: { with: { membership: { with: { profile: true } } } },
        },
      });
    },
  },
};

async function notifyBulletinPublished(ctx: GraphQLContext, bulletin: any) {
  const parentLinks = await ctx.db.query.parentStudents.findMany({
    where: eq(parentStudents.studentId, bulletin.studentId),
    with: {
      parent:  { with: { profile: true } },
      student: { with: { membership: { with: { profile: true } } } },
    },
  });

  const notifValues = [];
  for (const link of parentLinks) {
    const name = `${(link as ParentStudentData).student?.membership?.profile?.prenom} ${(link as ParentStudentData).student?.membership?.profile?.nom}`;
    notifValues.push({
      profileId: (link as ParentStudentData).parent?.profile?.id ?? "",
      schoolId:  ctx.currentUser?.schoolId ?? '',
      titre:     `📄 Bulletin ${bulletin.trimestre} disponible`,
      message:   `Le bulletin du ${bulletin.trimestre} de ${name} est maintenant disponible. Connectez-vous pour le consulter.`,
      type:      'BULLETIN' as const,
    });
    // Notifier aussi l'élève
    notifValues.push({
      profileId: (link as ParentStudentData).student?.membership?.profileId ?? "",
      schoolId:  ctx.currentUser?.schoolId ?? '',
      titre:     `📄 Ton bulletin ${bulletin.trimestre} est disponible`,
      message:   `Ton bulletin du ${bulletin.trimestre} vient d'être publié. Connecte-toi pour le télécharger.`,
      type:      'BULLETIN' as const,
    });
  }

  if (notifValues.length > 0) {
    await ctx.db.insert(notifications).values(notifValues);
  }

  // Envoyer email aux parents
  const school = await ctx.db.query.schools.findFirst({
    where: (s, { eq }) => eq(s.id, ctx.currentUser?.schoolId ?? ''),
  });
  for (const link of parentLinks) {
    const parentProfile  = (link as ParentStudentData).parent?.profile;
    const studentProfile = (link as ParentStudentData).student?.membership?.profile;
    if (parentProfile?.email) {
      await emailService.sendBulletinNotification({
        to:            parentProfile.email,
        parentPrenom:  parentProfile.prenom ?? 'Parent',
        studentPrenom: `${studentProfile?.prenom ?? ''} ${studentProfile?.nom ?? ''}`.trim(),
        trimestre:     bulletin.trimestre,
        anneeScolaire: bulletin.anneeScolaire ?? '',
        schoolName:    school?.nom ?? 'sulungukutu',
        moyenne:       bulletin.moyenneGenerale?.toString() ?? '0',
        mention:       bulletin.mention ?? 'Non évalué',
      });
    }
  }
}

