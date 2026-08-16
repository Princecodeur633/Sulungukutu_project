import { eq, and, isNull } from 'drizzle-orm';
import { subjects, classSubjects, grades, classes } from '../../db/schema';
import { requireSchoolMember, requireAdminOrTeacher, requireSchoolAdmin } from '../../middleware/permissions';
import { CreateSubjectSchema, AssignClassSubjectSchema } from '../../utils/validators/schemas';
import { auditService } from '../../services/audit.service';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../middleware/auth';

async function findOwnedSubject(ctx: GraphQLContext, id: string) {
  const subject = await ctx.db.query.subjects.findFirst({ where: eq(subjects.id, id) });
  if (!subject) {
    throw new GraphQLError('Matière introuvable.', { extensions: { code: 'NOT_FOUND' } });
  }
  return subject;
}

export const subjectResolvers = {
  Query: {
    subjectsBySchool: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      requireSchoolMember(ctx, args.schoolId);
      return ctx.db.query.subjects.findMany({
        // Les matières "soft-deleted" ne sont plus listées par défaut.
        where: and(eq(subjects.schoolId, args.schoolId), isNull(subjects.deletedAt)),
        orderBy: (s, { asc }) => [asc(s.nom)],
      });
    },

    subjectById: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const subject = await findOwnedSubject(ctx, args.id);
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      requireSchoolMember(ctx, subject.schoolId);
      return subject;
    },

    classSubjectsByClass: async (_: unknown, args: { classId: string }, ctx: GraphQLContext) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      const targetClass = await ctx.db.query.classes.findFirst({ where: eq(classes.id, args.classId) });
      if (!targetClass) {
        throw new GraphQLError('Classe introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      requireSchoolMember(ctx, targetClass.schoolId);
      return ctx.db.query.classSubjects.findMany({
        where: and(eq(classSubjects.classId, args.classId), isNull(classSubjects.deletedAt)),
        with: {
          subject: true,
          teacher: { with: { profile: true } },
          schedules: true,
          grades: {
            with: {
              student: {
                with: {
                  membership: { with: { profile: true } },
                },
              },
            },
          },
          attendances: true,
        },
      });
    },

    classSubjectsByTeacher: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      const user = requireAdminOrTeacher(ctx);
      return ctx.db.query.classSubjects.findMany({
        where: and(eq(classSubjects.teacherMembershipId, user.membershipId!), isNull(classSubjects.deletedAt)),
        with: {
          class: { with: { level: true } },
          subject: true,
          schedules: true,
        },
      });
    },

    classSubjectById: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const cs = await ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, args.id),
        with: { class: true, subject: true, teacher: { with: { profile: true } } },
      });
      if (!cs) {
        throw new GraphQLError('Association introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      requireSchoolMember(ctx, (cs as any).class.schoolId);
      return cs;
    },
  },

  Mutation: {
    createSubject: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const targetSchoolId = String(args.input.schoolId ?? '');
      const user  = requireSchoolAdmin(ctx, targetSchoolId);
      const input = CreateSubjectSchema.parse({ ...args.input, schoolId: targetSchoolId });
      const [created] = await ctx.db.insert(subjects).values(input).returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'SUBJECT_CREATED',
        entityType:  'subject',
        entityId:    created.id,
        description: `Matière créée : ${input.nom}`,
      });
      return created;
    },

    updateSubject: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const existing = await findOwnedSubject(ctx, args.id);
      // Avant : requireAdmin(ctx) seul → aucune vérification d'école, et
      // `.set(args.input)` en entier permettait de réécrire schoolId /
      // nationalSubjectId. Corrigé : scoping strict + whitelist.
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      const patch: Record<string, unknown> = {};
      if (typeof args.input.nom === 'string') patch.nom = args.input.nom;
      if (typeof args.input.description === 'string') patch.description = args.input.description;

      const [updated] = await ctx.db
        .update(subjects).set(patch).where(eq(subjects.id, args.id)).returning();

      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'SUBJECT_UPDATED',
        entityType:  'subject',
        entityId:    args.id,
        oldValue:    existing,
        newValue:    updated,
        description: `Matière modifiée : ${existing.nom}`,
      });

      return updated;
    },

    deleteSubject: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const existing = await findOwnedSubject(ctx, args.id);
      // Avant : requireAdmin(ctx) seul + DELETE physique. Corrigé :
      // scoping strict + soft delete + audit.
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      const [updated] = await ctx.db
        .update(subjects)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(subjects.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'SUBJECT_DELETED',
        entityType:  'subject',
        entityId:    args.id,
        oldValue:    existing,
        newValue:    updated,
        description: `Matière désactivée (soft delete) : ${existing.nom}`,
      });

      return true;
    },

    restoreSubject: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const existing = await findOwnedSubject(ctx, args.id);
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      const [updated] = await ctx.db
        .update(subjects)
        .set({ isActive: true, deletedAt: null })
        .where(eq(subjects.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'SUBJECT_UPDATED',
        entityType:  'subject',
        entityId:    args.id,
        oldValue:    existing,
        newValue:    updated,
        description: `Matière restaurée : ${existing.nom}`,
      });

      return updated;
    },

    assignClassSubject: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const input = AssignClassSubjectSchema.parse(args.input);

      // L'input ne porte pas de schoolId directement : on le dérive de la classe
      // ciblée, ce qui permet aussi bien à l'ADMIN de cette école qu'à un
      // SUPER_ADMIN (non rattaché à une école) d'effectuer cette action.
      const targetClass = await ctx.db.query.classes.findFirst({ where: eq(classes.id, input.classId) });
      if (!targetClass) {
        throw new GraphQLError('Classe introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const user = requireSchoolAdmin(ctx, targetClass.schoolId);

      // Vérifier si déjà existant → update sinon insert
      const existing = await ctx.db.query.classSubjects.findFirst({
        where: and(
          eq(classSubjects.classId, input.classId),
          eq(classSubjects.subjectId, input.subjectId)
        ),
      });

      let result;
      if (existing) {
        [result] = await ctx.db
          .update(classSubjects)
          .set({
            teacherMembershipId: input.teacherMembershipId,
            coefficient:         String(input.coefficient),
            hoursPerWeek:        input.hoursPerWeek,
            isActive:            true,
            deletedAt:           null,
          })
          .where(eq(classSubjects.id, existing.id))
          .returning();
      } else {
        [result] = await ctx.db
          .insert(classSubjects)
          .values({
            classId:             input.classId,
            subjectId:           input.subjectId,
            teacherMembershipId: input.teacherMembershipId,
            coefficient:         String(input.coefficient),
            hoursPerWeek:        input.hoursPerWeek,
          })
          .returning();
      }

      await auditService.log(ctx.db, {
        schoolId:    targetClass.schoolId,
        actorId:     user.membershipId,
        action:      'CLASS_SUBJECT_ASSIGNED',
        entityType:  'classSubject',
        entityId:    result.id,
        newValue:    args.input as Record<string, unknown>,
        description: `Matière assignée à la classe`,
      });

      return ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, result.id),
        with: { class: true, subject: true, teacher: { with: { profile: true } } },
      });
    },

    updateClassSubject: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const existing = await ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, args.id),
        with: { class: true },
      });
      if (!existing) {
        throw new GraphQLError('Association introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      // Avant : requireAdmin(ctx) seul (aucune vérification d'école) et
      // `.set(args.input)` en entier (mass-assignment possible sur classId/
      // subjectId). Corrigé.
      const user = requireSchoolAdmin(ctx, (existing as any).class.schoolId);

      const patch: Record<string, unknown> = {};
      if (args.input.teacherMembershipId !== undefined) patch.teacherMembershipId = args.input.teacherMembershipId;
      if (args.input.coefficient !== undefined) patch.coefficient = String(args.input.coefficient);
      if (args.input.hoursPerWeek !== undefined) patch.hoursPerWeek = args.input.hoursPerWeek;

      const [updated] = await ctx.db
        .update(classSubjects).set(patch).where(eq(classSubjects.id, args.id)).returning();

      await auditService.log(ctx.db, {
        schoolId:    (existing as any).class.schoolId,
        actorId:     user.membershipId,
        action:      'CLASS_SUBJECT_ASSIGNED',
        entityType:  'classSubject',
        entityId:    args.id,
        oldValue:    existing,
        newValue:    updated,
        description: 'Affectation classe/matière modifiée',
      });

      return updated;
    },

    removeClassSubject: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      // Dérive l'école depuis la classe liée (l'input ne porte qu'un id de
      // liaison classe/matière, pas de schoolId), pour autoriser correctement
      // aussi bien l'ADMIN de cette école qu'un SUPER_ADMIN.
      const existing = await ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, args.id),
        with: { class: true },
      });
      if (!existing) {
        throw new GraphQLError('Association introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const user = requireSchoolAdmin(ctx, (existing as any).class.schoolId);
      // Avant : DELETE physique — cascadait (onDelete 'cascade') sur TOUTES
      // les notes et présences liées à cette affectation. Corrigé : soft
      // delete, restaurable, les notes/présences existantes restent intactes.
      await ctx.db
        .update(classSubjects)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(classSubjects.id, args.id));
      await auditService.log(ctx.db, {
        schoolId:    (existing as any).class.schoolId,
        actorId:     user.membershipId,
        action:      'CLASS_SUBJECT_UNASSIGNED',
        entityType:  'classSubject',
        entityId:    args.id,
        description: 'Matière retirée de la classe (soft delete)',
      });
      return true;
    },
  },
};
