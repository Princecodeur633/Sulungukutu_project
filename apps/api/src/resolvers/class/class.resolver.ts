import { GraphQLError } from 'graphql';
import { eq, and, count, isNull } from 'drizzle-orm';
import { classes, students, classSubjects, levels } from '../../db/schema';
import { requireSchoolMember, requireAdminOrTeacher, requireSchoolAdmin } from '../../middleware/permissions';
import { CreateClassSchema } from '../../utils/validators/schemas';
import { auditService } from '../../services/audit.service';
import type { GraphQLContext } from '../../middleware/auth';

const classWithRelations = {
  level: true,
  classSubjects: {
    with: { subject: true, teacher: { with: { profile: true } }, schedules: true },
  },
  students: {
    with: { membership: { with: { profile: true } } },
  },
} as const;

async function findClassWithRelations(ctx: GraphQLContext, id: string) {
  return ctx.db.query.classes.findFirst({
    where: eq(classes.id, id),
    with: classWithRelations,
  });
}

async function findOwnedClass(ctx: GraphQLContext, id: string) {
  const cls = await ctx.db.query.classes.findFirst({ where: eq(classes.id, id) });
  if (!cls) {
    throw new GraphQLError('Classe introuvable.', { extensions: { code: 'NOT_FOUND' } });
  }
  return cls;
}

export const classResolvers = {
  Query: {
    classesBySchool: async (
      _: unknown,
      args: { schoolId: string; levelId?: string },
      ctx: GraphQLContext
    ) => {
      requireSchoolMember(ctx, args.schoolId);
      return ctx.db.query.classes.findMany({
        // Les classes "soft-deleted" ne sont plus listées par défaut.
        where: args.levelId
          ? and(eq(classes.schoolId, args.schoolId), eq(classes.levelId, args.levelId), isNull(classes.deletedAt))
          : and(eq(classes.schoolId, args.schoolId), isNull(classes.deletedAt)),
        orderBy: (c, { asc }) => [asc(c.nom)],
        with: {
          level: true,
          classSubjects: {
            with: { subject: true, teacher: { with: { profile: true } }, schedules: true },
          },
        },
      });
    },

    classesByTeacher: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      const user = requireAdminOrTeacher(ctx);
      // Trouver les classes via classSubjects de cet enseignant
      const teacherClassSubjects = await ctx.db.query.classSubjects.findMany({
        where: eq(classSubjects.teacherMembershipId, user.membershipId!),
        with: { class: { with: { level: true } } },
      });
      const uniqueClasses = new Map();
      for (const cs of teacherClassSubjects) {
        if (!uniqueClasses.has((cs as any).class.id)) { // eslint-disable-line @typescript-eslint/no-explicit-any
          uniqueClasses.set((cs as any).class.id, (cs as any).class); // eslint-disable-line @typescript-eslint/no-explicit-any
        }
      }
      return Array.from(uniqueClasses.values());
    },

    classById: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const cls = await findOwnedClass(ctx, args.id);
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      requireSchoolMember(ctx, cls.schoolId);
      return ctx.db.query.classes.findFirst({
        where: eq(classes.id, args.id),
        with: {
          level: true,
          classSubjects: {
            with: {
              subject: true,
              teacher: { with: { profile: true } },
              schedules: true,
            },
          },
          students: {
            with: { membership: { with: { profile: true } } },
          },
        },
      });
    },
  },

  Mutation: {
    createClass: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const targetSchoolId = String(args.input.schoolId ?? '');
      const user  = requireSchoolAdmin(ctx, targetSchoolId);
      const input = CreateClassSchema.parse({ ...args.input, schoolId: targetSchoolId });
      const [created] = await ctx.db.insert(classes).values(input).returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'CLASS_CREATED',
        entityType:  'class',
        entityId:    created.id,
        newValue:    created,
        description: `Classe créée : ${input.nom}`,
      });

      return findClassWithRelations(ctx, created.id);
    },

    updateClass: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const existing = await findOwnedClass(ctx, args.id);
      // Avant : requireAdmin(ctx) seul → aucune vérification d'école.
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      // Avant : `.set(args.input)` en entier → risque de mass-assignment
      // (schoolId, levelId d'une autre école...). On whiteliste les champs
      // réellement personnalisables localement par un établissement.
      const patch: Record<string, unknown> = {};
      if (typeof args.input.nom === 'string') patch.nom = args.input.nom;
      if (typeof args.input.anneeScolaire === 'string') patch.anneeScolaire = args.input.anneeScolaire;
      if (typeof args.input.levelId === 'string') {
        const nextLevel = await ctx.db.query.levels.findFirst({ where: eq(levels.id, args.input.levelId) });
        if (!nextLevel || nextLevel.schoolId !== existing.schoolId) {
          throw new GraphQLError('Niveau introuvable dans cet établissement.', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        patch.levelId = args.input.levelId;
      }

      const [updated] = await ctx.db
        .update(classes)
        .set(patch)
        .where(eq(classes.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'CLASS_UPDATED',
        entityType:  'class',
        entityId:    args.id,
        oldValue:    existing,
        newValue:    updated,
        description: `Classe modifiée : ${existing.nom}`,
      });

      return findClassWithRelations(ctx, updated.id);
    },

    deleteClass: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const cls  = await findOwnedClass(ctx, args.id);
      // Avant : DELETE physique — avec CASCADE sur classSubjects/students,
      // supprimer une classe par erreur effaçait aussi les inscriptions
      // réelles des élèves. Corrigé : soft delete, rien n'est jamais perdu.
      const user = requireSchoolAdmin(ctx, cls.schoolId);

      const [updated] = await ctx.db
        .update(classes)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(classes.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    cls.schoolId,
        actorId:     user.membershipId!,
        action:      'CLASS_DELETED',
        entityType:  'class',
        entityId:    args.id,
        oldValue:    cls,
        newValue:    updated,
        description: `Classe désactivée (soft delete) : ${cls.nom}`,
      });
      return true;
    },

    restoreClass: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const existing = await findOwnedClass(ctx, args.id);
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      const [updated] = await ctx.db
        .update(classes)
        .set({ isActive: true, deletedAt: null })
        .where(eq(classes.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'CLASS_UPDATED',
        entityType:  'class',
        entityId:    args.id,
        oldValue:    existing,
        newValue:    updated,
        description: `Classe restaurée : ${existing.nom}`,
      });

      return findClassWithRelations(ctx, updated.id);
    },
  },

  // Resolver pour le champ calculé studentCount
  Class: {
    studentCount: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const [result] = await ctx.db
        .select({ count: count() })
        .from(students)
        .where(eq(students.classId, parent.id));
      return Number(result.count);
    },
    level: async (parent: { level?: unknown; levelId?: string }, _: unknown, ctx: GraphQLContext) => {
      if (parent.level) return parent.level;
      if (!parent.levelId) return null;
      return ctx.db.query.levels.findFirst({ where: eq(levels.id, parent.levelId) });
    },
  },
};
