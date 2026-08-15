import { generateTempPassword } from '../../utils/password';
import { normalizePhone } from '../../utils/phone';
import { withFriendlyUniqueError } from '../../utils/db-errors';
import bcrypt from 'bcryptjs';
import { eq, and, count, or, sql } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import {
  schools,
  globalProfiles,
  schoolMemberships,
  levels,
  subjects,
} from '../../db/schema';
import {
  requireSuperAdmin,
  requireAdmin,
  requireSchoolMember,
  requireSchoolAdmin,
} from '../../middleware/permissions';
import {
  generateShortCode,
  generateSchoolCode,
} from '../../utils/code-generator';
import { CreateSchoolSchema } from '../../utils/validators/schemas';
import { auditService } from '../../services/audit.service';
import { emailService } from '../../services/email.service';
import { nationalReferentialService } from '../../services/national-referential.service';
import { identityService } from '../../services/identity.service';
import type { GraphQLContext } from '../../middleware/auth';

export const schoolResolvers = {
  Query: {
    // Référentiel national complet (lecture seule) — n'importe quel
    // utilisateur authentifié peut le consulter (ex: pour afficher les
    // niveaux/matières disponibles à l'activation).
    nationalReferential: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAdmin(ctx); // réservé aux admins (super admin + admin d'école)
      const [levelsData, seriesData, subjectsData, curriculumData] = await Promise.all([
        ctx.db.query.nationalLevels.findMany({ orderBy: (l, { asc }) => [asc(l.ordre)] }),
        ctx.db.query.nationalSeries.findMany(),
        ctx.db.query.nationalSubjects.findMany(),
        ctx.db.query.nationalCurriculum.findMany(),
      ]);
      return {
        levels: levelsData,
        series: seriesData,
        subjects: subjectsData,
        curriculum: curriculumData,
      };
    },

    // Dashboard Super Admin
    superAdminDashboard: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireSuperAdmin(ctx);
      const [schoolCount] = await ctx.db
        .select({ count: count() })
        .from(schools);
      const [profileCount] = await ctx.db
        .select({ count: count() })
        .from(globalProfiles);
      const recentSchools = await ctx.db.query.schools.findMany({
        orderBy: (s, { desc }) => [desc(s.createdAt)],
        limit: 5,
      });
      return {
        totalSchools:  Number(schoolCount.count),
        totalProfiles: Number(profileCount.count),
        recentSchools,
      };
    },

    // Liste de toutes les écoles (super admin)
    allSchools: async (
      _: unknown,
      args: { pagination?: { page: number; limit: number } },
      ctx: GraphQLContext
    ) => {
      requireSuperAdmin(ctx);
      const page  = args.pagination?.page  ?? 1;
      const limit = args.pagination?.limit ?? 20;
      const offset = (page - 1) * limit;

      const [data, total] = await Promise.all([
        ctx.db.query.schools.findMany({
          limit,
          offset,
          orderBy: (s, { desc }) => [desc(s.createdAt)],
        }),
        ctx.db.select({ count: count() }).from(schools),
      ]);

      const totalCount = Number(total[0].count);
      return {
        data,
        pageInfo: {
          hasNextPage:     offset + limit < totalCount,
          hasPreviousPage: page > 1,
          totalCount,
          currentPage:     page,
          totalPages:      Math.ceil(totalCount / limit),
        },
      };
    },


    // Liste tous les profils globaux (super admin)
    allProfiles: async (
      _: unknown,
      args: { pagination?: { page: number; limit: number } },
      ctx: GraphQLContext
    ) => {
      requireSuperAdmin(ctx);
      const page   = args.pagination?.page  ?? 1;
      const limit  = args.pagination?.limit ?? 25;
      const offset = (page - 1) * limit;

      const [data, total] = await Promise.all([
        ctx.db.query.globalProfiles.findMany({
          limit,
          offset,
          orderBy: (p, { desc }) => [desc(p.createdAt)],
          with: {
            memberships: {
              with: { school: true, studentProfile: true },
            },
          },
        }),
        ctx.db.select({ count: count() }).from(globalProfiles),
      ]);

      const totalCount = Number(total[0].count);
      return {
        data,
        pageInfo: {
          hasNextPage:     offset + limit < totalCount,
          hasPreviousPage: page > 1,
          totalCount,
          currentPage:     page,
          totalPages:      Math.ceil(totalCount / limit),
        },
      };
    },

    // Détail d'une école
    schoolById: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      requireSuperAdmin(ctx);
      return ctx.db.query.schools.findFirst({
        where: eq(schools.id, args.id),
        with:  { levels: true, classes: true },
      });
    },

    // Mon école (admin)
    mySchool: async (
      _: unknown,
      args: { schoolId: string },
      ctx: GraphQLContext
    ) => {
      requireSchoolMember(ctx, args.schoolId);
      return ctx.db.query.schools.findFirst({
        where: eq(schools.id, args.schoolId),
        with:  { levels: true },
      });
    },
  },

  Mutation: {
    // Créer un établissement + son admin (Super Admin seulement)
    createSchool: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      requireSuperAdmin(ctx);
      if (!(args.input as any)?.adminEmail && !(args.input as any)?.adminPhone) {
        throw new GraphQLError(
          "L'email ou le téléphone de l'administrateur est requis.",
          { extensions: { code: 'BAD_USER_INPUT' } }
        );
      }
      const input = CreateSchoolSchema.parse(args.input);

      // Comptage pour le code de l'école
      // NOTE: un simple COUNT(*) + insert n'est pas atomique — deux créations
      // concurrentes peuvent lire le même compte et produire le même code
      // (colonne UNIQUE). On retente avec un nouveau compte en cas de collision
      // plutôt que de laisser remonter une erreur SQL brute au client.
      let newSchool;
      let attempt = 0;
      while (!newSchool) {
        attempt++;
        const [{ count: schoolCount }] = await ctx.db
          .select({ count: count() })
          .from(schools);
        const schoolCode = generateSchoolCode(input.nom, Number(schoolCount) + attempt);

        try {
          [newSchool] = await ctx.db
            .insert(schools)
            .values({
              code:          schoolCode,
              nom:           input.nom,
              adresse:       input.adresse,
              telephone:     input.telephone,
              anneeScolaire: input.anneeScolaire,
              logoUrl:       input.logoUrl,
            })
            .returning();
        } catch (err: any) {
          const isUniqueViolation = err?.code === '23505' || /unique/i.test(err?.message ?? '');
          if (isUniqueViolation && attempt < 5) {
            continue; // retente avec un compte actualisé
          }
          throw err;
        }
      }

      // Avant : recherche par email uniquement, et email obligatoire pour
      // créer l'admin. Désormais reconnu aussi par téléphone (normalisé),
      // comme pour createStudent/inviteUser — cohérent dans toute la plateforme.
      const normalizedAdminPhone = input.adminPhone ? normalizePhone(input.adminPhone) : null;
      let adminProfile = await ctx.db.query.globalProfiles.findFirst({
        where: or(
          input.adminEmail ? eq(globalProfiles.email, input.adminEmail) : undefined,
          normalizedAdminPhone
            ? sql`regexp_replace(${globalProfiles.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedAdminPhone.slice(-8)}`
            : undefined,
        ),
      });

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const adminProfileWasCreated = !adminProfile;

      if (!adminProfile) {
        // Créer le profil global de l'admin. Sans email réel, un email
        // interne est généré (jamais une chaîne vide) — comme pour tous
        // les autres rôles créés sans email personnel.
        const adminCode = generateShortCode('ADM', input.adminNom, input.adminPrenom);
        const email = input.adminEmail
          ?? (await identityService.generateUniqueInternalEmail(
                ctx.db, input.adminNom, input.adminPrenom, newSchool.code
              )).email;
        const [created] = await withFriendlyUniqueError(() => ctx.db
          .insert(globalProfiles)
          .values({
            code:         adminCode,
            nom:          input.adminNom,
            prenom:       input.adminPrenom,
            email,
            phone:        input.adminPhone,
            passwordHash,
          })
          .returning());
        adminProfile = created;
      }

      // Créer le membership ADMIN pour cette école
      const membershipCode = generateShortCode('ADM', input.adminNom, input.adminPrenom);
      await ctx.db.insert(schoolMemberships).values({
        profileId: adminProfile.id,
        schoolId:  newSchool.id,
        role:      'ADMIN',
        code:      membershipCode,
        status:    'ACTIVE',
      });

      // Initialiser automatiquement la configuration pédagogique de l'école
      // à partir du référentiel national (Congo-Brazzaville) — sans saisie
      // manuelle. L'admin pourra ensuite activer/désactiver/personnaliser
      // (niveaux, matières, coefficients), jamais modifier le référentiel.
      await nationalReferentialService.seed(ctx.db); // no-op si déjà seedé
      const cycles = (input.cycles as Array<'PRIMAIRE' | 'COLLEGE' | 'LYCEE'>) ?? undefined;
      const divisions = (input.divisions as string[] | undefined) ?? ['1', '2', '3', '4'];
      const provisioning = await nationalReferentialService.provisionSchool(
        ctx.db, newSchool.id, cycles, newSchool.anneeScolaire, divisions
      );
      await auditService.log(ctx.db, {
        schoolId:   newSchool.id,
        actorId:    ctx.currentUser?.membershipId ?? null,
        action:     'SCHOOL_PEDAGOGY_PROVISIONED',
        entityType: 'school',
        entityId:   newSchool.id,
        newValue:   provisioning,
        description: `${provisioning.levelsCreated} niveaux, ${provisioning.classesCreated} classes et ${provisioning.subjectsCreated} matières activés depuis le référentiel national`,
      }).catch(() => {});

      // Envoyer email avec identifiants temporaires (non bloquant, seulement
      // si un email réel a été fourni — jamais vers un email interne généré).
      if (input.adminEmail && adminProfileWasCreated) {
        emailService.sendInvitation({
          to:          input.adminEmail,
          prenom:      input.adminPrenom,
          nom:         input.adminNom,
          role:        "ADMIN",
          schoolName:  newSchool.nom,
          tempPassword: tempPassword,
        }).catch((err) => console.error("[Email création école]", err));
      }
      console.log("[School created]", newSchool.nom, input.adminEmail ?? input.adminPhone);

      return {
        school: newSchool,
        adminIdentifiant: input.adminEmail ?? adminProfile.code,
        adminTempPassword: adminProfileWasCreated
          ? tempPassword
          : '(compte existant — mot de passe inchangé)',
        hasRealEmail: !!input.adminEmail,
      };
    },

    // Active/désactive un niveau déjà provisionné depuis le référentiel
    // national. L'admin d'école NE PEUT PAS créer un niveau hors référentiel
    // ni modifier les données nationales — uniquement basculer isActive.
    toggleSchoolLevel: async (
      _: unknown,
      args: { levelId: string; isActive: boolean },
      ctx: GraphQLContext
    ) => {
      const level = await ctx.db.query.levels.findFirst({ where: eq(levels.id, args.levelId) });
      if (!level) throw new GraphQLError('Niveau introuvable', { extensions: { code: 'NOT_FOUND' } });
      const user = requireSchoolAdmin(ctx, level.schoolId);

      const updated = await ctx.db
        .update(levels)
        .set({ isActive: args.isActive })
        .where(eq(levels.id, args.levelId))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:   level.schoolId,
        actorId:    user.membershipId,
        action:     'SCHOOL_LEVEL_TOGGLED',
        entityType: 'level',
        entityId:   args.levelId,
        newValue:   { isActive: args.isActive },
        description: `Niveau "${level.nom}" ${args.isActive ? 'activé' : 'désactivé'}`,
      });

      return updated[0];
    },

    toggleSchoolSubject: async (
      _: unknown,
      args: { subjectId: string; isActive: boolean },
      ctx: GraphQLContext
    ) => {
      const subject = await ctx.db.query.subjects.findFirst({ where: eq(subjects.id, args.subjectId) });
      if (!subject) throw new GraphQLError('Matière introuvable', { extensions: { code: 'NOT_FOUND' } });
      const user = requireSchoolAdmin(ctx, subject.schoolId);

      const updated = await ctx.db
        .update(subjects)
        .set({ isActive: args.isActive })
        .where(eq(subjects.id, args.subjectId))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:   subject.schoolId,
        actorId:    user.membershipId,
        action:     'SCHOOL_SUBJECT_TOGGLED',
        entityType: 'subject',
        entityId:   args.subjectId,
        newValue:   { isActive: args.isActive },
        description: `Matière "${subject.nom}" ${args.isActive ? 'activée' : 'désactivée'}`,
      });

      return updated[0];
    },

    // Modifier une école (Super Admin)
    updateSchoolBySuper: async (
      _: unknown,
      args: { schoolId: string; input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      requireSuperAdmin(ctx);
      const [updated] = await ctx.db
        .update(schools)
        .set({ ...args.input, updatedAt: new Date() })
        .where(eq(schools.id, args.schoolId))
        .returning();
      return updated;
    },

    // Désactiver une école (Super Admin)
    deactivateSchool: async (
      _: unknown,
      args: { schoolId: string },
      ctx: GraphQLContext
    ) => {
      requireSuperAdmin(ctx);
      await ctx.db
        .update(schools)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schools.id, args.schoolId));
      return true;
    },

    // Modifier son école (Admin)
    updateSchool: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const user = requireAdmin(ctx);
      if (!user.schoolId) throw new GraphQLError('Aucune école active dans le contexte');

      const [updated] = await ctx.db
        .update(schools)
        .set({ ...args.input, updatedAt: new Date() })
        .where(eq(schools.id, user.schoolId))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    user.schoolId,
        actorId:     user.membershipId!,
        action:      'SCHOOL_UPDATED',
        entityType:  'school',
        entityId:    user.schoolId,
        description: `École mise à jour`,
      });

      return updated;
    },

    // NOTE: la mutation `updateMembershipStatus` est implémentée dans
    // user.resolver.ts (c'est cette version qui est réellement active,
    // car les resolvers de user.resolver.ts sont fusionnés après ceux-ci
    // dans index.ts et écrasent donc toute définition en double). Une
    // seconde implémentation existait ici par erreur et a été supprimée
    // pour éviter toute confusion — elle n'était jamais exécutée.

    exportData: async (
      _: unknown,
      args: { input: { type: string; classId?: string; trimestre?: string; anneeScolaire?: string } },
      ctx: GraphQLContext
    ) => {
      requireAdmin(ctx);
      return {
        url:      `/export/${args.input.type.toLowerCase()}?classId=${args.input.classId ?? ''}`,
        filename: `export_${args.input.type}_${Date.now()}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────
