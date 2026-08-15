import { eq, and, isNull } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { levels } from '../../db/schema';
import { requireSchoolMember, requireSchoolAdmin } from '../../middleware/permissions';
import { CreateLevelSchema } from '../../utils/validators/schemas';
import { auditService } from '../../services/audit.service';
import type { GraphQLContext } from '../../middleware/auth';

async function findOwnedLevel(ctx: GraphQLContext, id: string) {
  const level = await ctx.db.query.levels.findFirst({ where: eq(levels.id, id) });
  if (!level) {
    throw new GraphQLError('Niveau introuvable.', { extensions: { code: 'NOT_FOUND' } });
  }
  return level;
}

export const levelResolvers = {
  Query: {
    levelsBySchool: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      requireSchoolMember(ctx, args.schoolId);
      return ctx.db.query.levels.findMany({
        // Les niveaux "soft-deleted" par l'école ne sont plus listés — la
        // ligne (et son historique d'audit) reste en base, jamais perdue.
        where: and(eq(levels.schoolId, args.schoolId), isNull(levels.deletedAt)),
        orderBy: (l, { asc }) => [asc(l.ordre)],
        with: { classes: true },
      });
    },

    levelById: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const level = await findOwnedLevel(ctx, args.id);
      // Avant : requireSchoolMember(ctx, '') = authentification seule, sans
      // vérifier que l'appelant appartient bien à l'école de ce niveau.
      requireSchoolMember(ctx, level.schoolId);
      return ctx.db.query.levels.findFirst({
        where: eq(levels.id, args.id),
        with: { classes: true },
      });
    },
  },

  Mutation: {
    createLevel: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const targetSchoolId = String(args.input.schoolId ?? '');
      const user  = requireSchoolAdmin(ctx, targetSchoolId);
      const input = CreateLevelSchema.parse({ ...args.input, schoolId: targetSchoolId });

      const [created] = await ctx.db.insert(levels).values(input).returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'CLASS_CREATED',
        entityType:  'level',
        entityId:    created.id,
        newValue:    created,
        description: `Niveau créé : ${input.nom}`,
      });

      return created;
    },

    updateLevel: async (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const existing = await findOwnedLevel(ctx, args.id);
      // Avant : requireAdmin(ctx) seul → un admin de N'IMPORTE QUELLE école
      // pouvait modifier le niveau de N'IMPORTE QUELLE AUTRE école. Corrigé.
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      // Avant : `.set(args.input)` en entier → un appelant pouvait réécrire
      // schoolId, nationalLevelId ou isActive via cette mutation "update"
      // générique. On ne permet ici que la personnalisation locale
      // (nom / ordre) — jamais le rattachement au référentiel national ni
      // l'établissement propriétaire.
      const patch: Record<string, unknown> = {};
      if (typeof args.input.nom === 'string') patch.nom = args.input.nom;
      if (typeof args.input.ordre === 'number') patch.ordre = args.input.ordre;

      const [updated] = await ctx.db
        .update(levels)
        .set(patch)
        .where(eq(levels.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'CLASS_UPDATED',
        entityType:  'level',
        entityId:    args.id,
        oldValue:    existing,
        newValue:    updated,
        description: `Niveau modifié : ${existing.nom}`,
      });

      return updated;
    },

    deleteLevel: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const existing = await findOwnedLevel(ctx, args.id);
      // Avant : requireAdmin(ctx) seul (aucune vérification d'école) +
      // DELETE physique — un admin pouvait supprimer le niveau d'une autre
      // école. Corrigé : scoping strict + soft delete (jamais de DELETE réel
      // sur une donnée fonctionnelle ; le référentiel national n'est de
      // toute façon jamais touché par cette table).
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      const [updated] = await ctx.db
        .update(levels)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(levels.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'CLASS_DELETED',
        entityType:  'level',
        entityId:    args.id,
        oldValue:    existing,
        newValue:    updated,
        description: `Niveau désactivé (soft delete) : ${existing.nom}`,
      });

      return true;
    },

    restoreLevel: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const existing = await findOwnedLevel(ctx, args.id);
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      const [updated] = await ctx.db
        .update(levels)
        .set({ isActive: true, deletedAt: null })
        .where(eq(levels.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'CLASS_UPDATED',
        entityType:  'level',
        entityId:    args.id,
        oldValue:    existing,
        newValue:    updated,
        description: `Niveau restauré : ${existing.nom}`,
      });

      return updated;
    },
  },
};
