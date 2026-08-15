import { generateTempPassword } from '../../utils/password';
import { normalizePhone } from '../../utils/phone';
import { withFriendlyUniqueError } from '../../utils/db-errors';
import bcrypt from 'bcryptjs';
import { and, count, eq, ilike, or, inArray, ne, sql } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { classes, globalProfiles, schoolMemberships, students, subjects, schools } from '../../db/schema';
import { requireAuth, requireSchoolMember, requireSchoolAdmin } from '../../middleware/permissions';
import { auditService } from '../../services/audit.service';
import { identityService } from '../../services/identity.service';
import type { GraphQLContext } from '../../middleware/auth';
import { emailService }  from '../../services/email.service';

export const userResolvers = {
  GlobalProfile: {
    isSuperAdmin: (parent: any) => parent.isSuperAdmin ?? false, // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  Query: {
    // Annuaire des identifiants — pour retrouver/rappeler les infos d'un
    // utilisateur qui appelle (jamais de mot de passe en clair : voir
    // adminResetPassword pour en générer un nouveau si besoin).
    usersDirectory: async (
      _: unknown,
      args: { schoolId?: string },
      ctx: GraphQLContext
    ) => {
      const user = requireAuth(ctx);
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        throw new GraphQLError('Accès refusé — permissions insuffisantes.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      let membershipConditions;
      if (user.role === 'ADMIN') {
        // Un admin d'école est toujours cantonné à SA propre école, et ne
        // voit jamais les autres admins — uniquement enseignants/parents/élèves.
        membershipConditions = and(
          eq(schoolMemberships.schoolId, user.schoolId!),
          inArray(schoolMemberships.role, ['TEACHER', 'PARENT', 'STUDENT']),
        );
      } else {
        // SUPER_ADMIN : toute la plateforme (école optionnelle en filtre),
        // mais jamais les autres super admins.
        membershipConditions = args.schoolId
          ? and(eq(schoolMemberships.schoolId, args.schoolId), ne(schoolMemberships.role, 'SUPER_ADMIN'))
          : ne(schoolMemberships.role, 'SUPER_ADMIN');
      }

      const rows = await ctx.db.query.schoolMemberships.findMany({
        where: membershipConditions,
        with: { profile: true, school: true },
        orderBy: (m, { asc }) => [asc(m.role)],
      });

      // Récupérer les matricules des élèves en un seul aller
      const studentMembershipIds = rows.filter((r) => r.role === 'STUDENT').map((r) => r.id);
      const studentRows = studentMembershipIds.length > 0
        ? await ctx.db.query.students.findMany({
            where: inArray(students.membershipId, studentMembershipIds),
            columns: { membershipId: true, matricule: true },
          })
        : [];
      const matriculeByMembership = new Map(studentRows.map((s) => [s.membershipId, s.matricule]));

      return rows.map((m) => ({
        membershipId: m.id,
        code:         m.profile.code,
        matricule:    matriculeByMembership.get(m.id) ?? null,
        nom:          m.profile.nom,
        prenom:       m.profile.prenom,
        email:        m.profile.email,
        phone:        m.profile.phone,
        role:         m.role,
        status:       m.status,
        schoolName:   (m as any).school?.nom ?? '',
        joinedAt:     m.joinedAt,
      }));
    },

    schoolMembers: async (
      _: unknown,
      args: {
        schoolId:   string;
        role?:      string;
        pagination?: { page: number; limit: number };
      },
      ctx: GraphQLContext
    ) => {
      requireSchoolMember(ctx, args.schoolId);

      const page   = args.pagination?.page  ?? 1;
      const limit  = args.pagination?.limit ?? 30;
      const offset = (page - 1) * limit;

      const conditions = [eq(schoolMemberships.schoolId, args.schoolId)];
      if (args.role) conditions.push(eq(schoolMemberships.role, args.role as 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT'));

      const [data, total] = await Promise.all([
        ctx.db.query.schoolMemberships.findMany({
          where:   and(...conditions),
          limit,
          offset,
          orderBy: (m, { desc }) => [desc(m.joinedAt)],
          with:    { profile: true },
        }),
        ctx.db.select({ count: count() }).from(schoolMemberships).where(and(...conditions)),
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



    searchMembers: async (
      _: unknown,
      args: { schoolId: string; query?: string; role?: string },
      ctx: GraphQLContext
    ) => {
      requireSchoolMember(ctx, args.schoolId);
      const q = args.query ?? '';

      const members = await ctx.db.query.schoolMemberships.findMany({
        where: and(
          eq(schoolMemberships.schoolId, args.schoolId),
          args.role ? eq(schoolMemberships.role, args.role as 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT') : undefined,
          eq(schoolMemberships.status, 'ACTIVE'),
        ),
        with: { profile: true },
        limit: 50,
      });
      
      if (!q) return members;
      
      return members.filter((m) => {
        const name = `${m.profile?.prenom ?? ''} ${m.profile?.nom ?? ''} ${m.profile?.email ?? ''}`.toLowerCase();
        return name.includes(q.toLowerCase());
      });
    },


    globalSearch: async (
      _: unknown,
      args: { schoolId: string; query: string },
      ctx: GraphQLContext
    ) => {
      requireSchoolMember(ctx, args.schoolId);
      if (!args.query || args.query.trim().length < 2) return [];
      const q = `%${args.query.trim()}%`;
      const results: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

      // Élèves: chercher via membership + profile
      const studentMembers = await ctx.db.query.schoolMemberships.findMany({
        where: and(
          eq(schoolMemberships.schoolId, args.schoolId),
          eq(schoolMemberships.role, 'STUDENT'),
        ),
        with: { profile: true },
        limit: 20,
      });
      for (const m of studentMembers) {
        const name = `${m.profile?.prenom ?? ''} ${m.profile?.nom ?? ''}`.toLowerCase();
        if (name.includes(args.query.toLowerCase())) {
          // Trouver le student pour avoir son id
          const student = await ctx.db.query.students.findFirst({
            where: eq(students.membershipId, m.id),
          });
          if (student) results.push({
            type: 'student', id: student.id,
            label: `${m.profile?.prenom} ${m.profile?.nom}`,
            sublabel: `Élève · ${m.code}`,
            href: `/admin/students`,
          });
        }
      }

      // Enseignants
      const teacherMembers = await ctx.db.query.schoolMemberships.findMany({
        where: and(
          eq(schoolMemberships.schoolId, args.schoolId),
          eq(schoolMemberships.role, 'TEACHER'),
        ),
        with: { profile: true },
        limit: 10,
      });
      for (const m of teacherMembers) {
        const name = `${m.profile?.prenom ?? ''} ${m.profile?.nom ?? ''}`.toLowerCase();
        if (name.includes(args.query.toLowerCase())) {
          results.push({
            type: 'teacher', id: m.id,
            label: `${m.profile?.prenom} ${m.profile?.nom}`,
            sublabel: 'Enseignant',
            href: `/admin/teachers`,
          });
        }
      }

      // Classes
      const foundClasses = await ctx.db.query.classes.findMany({
        where: and(eq(classes.schoolId, args.schoolId), ilike(classes.nom, q)),
        limit: 5,
      });
      for (const c of foundClasses) {
        results.push({ type: 'class', id: c.id, label: c.nom, sublabel: 'Classe', href: `/admin/classes` });
      }

      // Matières
      const foundSubjects = await ctx.db.query.subjects.findMany({
        where: and(eq(subjects.schoolId, args.schoolId), ilike(subjects.nom, q)),
        limit: 5,
      });
      for (const s of foundSubjects) {
        results.push({ type: 'subject', id: s.id, label: s.nom, sublabel: 'Matière', href: `/admin/subjects` });
      }

      return results.slice(0, 12);
    },

    searchProfile: async (
      _: unknown,
      args: { emailOrCode: string },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule, sans
      // aucun filtre d'école. N'importe quel admin pouvait retrouver le nom,
      // l'email, le téléphone de N'IMPORTE QUEL profil de N'IMPORTE QUELLE
      // AUTRE école — fuite de données personnelles cross-tenant. Corrigé :
      // on restreint désormais aux profils ayant un membership actif dans
      // l'école de l'appelant (le Super Admin garde une recherche globale).
      const user = requireAuth(ctx);

      // Avant : recherche par email ou code uniquement — un admin qui
      // reçoit un appel avec juste un numéro de téléphone ne pouvait pas
      // retrouver le compte correspondant. Ajouté : recherche aussi par
      // téléphone normalisé (espaces/tirets/+242 ignorés), pour une
      // identification plus précise (même personne = même email OU même
      // téléphone).
      const normalizedPhone = normalizePhone(args.emailOrCode);
      const candidates = await ctx.db.query.globalProfiles.findMany({
        where: or(
          ilike(globalProfiles.email, args.emailOrCode),
          ilike(globalProfiles.code,  args.emailOrCode),
          normalizedPhone.length >= 8
            ? sql`regexp_replace(${globalProfiles.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedPhone.slice(-8)}`
            : undefined,
        ),
        with: { memberships: true },
      });

      if (user.role === 'SUPER_ADMIN') {
        return candidates[0] ?? null;
      }

      const match = candidates.find((p) =>
        (p as any).memberships?.some((m: any) => m.schoolId === user.schoolId)
      );
      return match ?? null;
    },

  },

  Mutation: {
    /**
     * Inviter un enseignant ou un parent dans l'école
     * Crée le profil si inexistant, crée le membership, envoie email
     */
    inviteUser: async (
      _: unknown,
      args: {
        input: {
          schoolId: string;
          email?:    string;
          profileCode?: string;
          nom?:      string;
          prenom?:   string;
          role:     'TEACHER' | 'PARENT' | 'ADMIN';
          phone?:   string;
        };
      },
      ctx: GraphQLContext
    ) => {
      const input = args.input;

      // Le contrôle précédent (comparaison manuelle à `user.schoolId`)
      // était en fait correct — `schoolId` est bien peuplé dans le JWT au
      // login. Ce changement centralise simplement la logique via le même
      // helper que le reste du code, sans changement de comportement.
      const user = requireSchoolAdmin(ctx, input.schoolId);

      // École nécessaire pour l'Identity Service (code école utilisé dans
      // la génération d'un éventuel email interne / pour l'audit trail).
      const school = await ctx.db.query.schools.findFirst({
        where: (s, { eq }) => eq(s.id, input.schoolId),
      });

      // Avant : `profileCode` était déclaré dans le schéma ("invitation par
      // email OU code profil") mais jamais implémenté — cette branche
      // n'existait tout simplement pas. Elle permet de rattacher un
      // nouveau rôle à une personne déjà connue (ex: un enseignant qui
      // devient aussi parent) sans ressaisir ses informations.
      let profile = input.profileCode
        ? await ctx.db.query.globalProfiles.findFirst({
            where: eq(globalProfiles.code, input.profileCode.toUpperCase()),
          })
        : null;

      if (input.profileCode && !profile) {
        throw new GraphQLError('Identifiant introuvable', { extensions: { code: 'NOT_FOUND' } });
      }

      // Avant : `email` était en pratique obligatoire (recherche et
      // insertion sur `input.email` sans garde), alors que beaucoup
      // d'enseignants/admins n'ont qu'un téléphone. Désormais reconnu
      // aussi par téléphone normalisé, comme pour élèves/parents.
      if (!profile && (input.email || input.phone)) {
        const normalizedPhone = input.phone ? normalizePhone(input.phone) : null;
        profile = await ctx.db.query.globalProfiles.findFirst({
          where: or(
            input.email ? eq(globalProfiles.email, input.email) : undefined,
            normalizedPhone
              ? sql`regexp_replace(${globalProfiles.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedPhone.slice(-8)}`
              : undefined,
          ),
        });
      }

      if (!profile && !input.nom) {
        throw new GraphQLError(
          'Un nom est requis pour créer un nouveau profil (ou fournissez un identifiant existant).',
          { extensions: { code: 'BAD_USER_INPUT' } }
        );
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      let profileWasCreated = false;

      if (!profile) {
        const identity = await identityService.createIdentity(ctx.db, {
          role: input.role,
          nom: input.nom!,
          prenom: input.prenom ?? '',
          schoolId: input.schoolId,
          schoolCode: school?.code ?? input.schoolId,
          explicitEmail: input.email ?? null,
          actorMembershipId: user.membershipId,
        });
        const [created] = await withFriendlyUniqueError(() => ctx.db
          .insert(globalProfiles)
          .values({
            code: identity.code,
            nom:    input.nom!,
            prenom: input.prenom ?? '',
            email:  identity.email,
            phone:  input.phone,
            passwordHash,
          })
          .returning());
        profile = created;
        profileWasCreated = true;
      }

      // Vérifier doublon membership
      const existingMembership = await ctx.db.query.schoolMemberships.findFirst({
        where: and(
          eq(schoolMemberships.profileId, profile.id),
          eq(schoolMemberships.schoolId,  input.schoolId),
          eq(schoolMemberships.role,       input.role),
        ),
      });

      if (existingMembership) {
        throw new GraphQLError(
          `${profile.prenom} ${profile.nom} a déjà le rôle ${input.role} dans cet établissement.`
        );
      }

      const memberCode = await identityService.generateUniqueLoginCode(
        ctx.db, input.role, profile.nom, profile.prenom
      );
      const [membership] = await ctx.db
        .insert(schoolMemberships)
        .values({
          profileId: profile.id,
          schoolId:  input.schoolId,
          role:      input.role,
          code:      memberCode,
          status:    'ACTIVE',
        })
        .returning();

      // Envoyer l'email d'invitation (seulement si un email réel a été
      // fourni — l'email interne généré automatiquement n'est jamais une
      // vraie boîte mail, inutile d'essayer de l'y envoyer).
      if (input.email) {
        const schoolForEmail = school ?? await ctx.db.query.schools.findFirst({
          where: (s, { eq }) => eq(s.id, input.schoolId),
        });
        await emailService.sendInvitation({
          to:           input.email,
          prenom:       profile.prenom,
          nom:          profile.nom,
          role:         input.role,
          schoolName:   schoolForEmail?.nom ?? input.schoolId,
          tempPassword: profileWasCreated ? tempPassword : '(compte existant — utilisez votre mot de passe)',
        }).catch(() => {});
      }

      await auditService.log(ctx.db, {
        schoolId:    input.schoolId,
        actorId:     user.membershipId!,
        action:      'USER_INVITED',
        entityType:  'membership',
        entityId:    membership.id,
        description: `${input.role} invité : ${profile.prenom} ${profile.nom} (${profile.email})`,
      });

      const membershipResult = await ctx.db.query.schoolMemberships.findFirst({
        where: eq(schoolMemberships.id, membership.id),
        with:  { profile: true, school: true },
      });

      return {
        membership: membershipResult,
        tempPassword: profileWasCreated
          ? tempPassword
          : '(compte existant — mot de passe inchangé)',
      };
    },

    updateMembershipStatus: async (
      _: unknown,
      args: { input: { membershipId: string; status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' } },
      ctx: GraphQLContext
    ) => {
      const { membershipId, status } = args.input;

      // Avant : requireAdmin(ctx) seul — un admin de N'IMPORTE QUELLE école
      // pouvait activer/suspendre le compte d'un membre d'une AUTRE école.
      // Corrigé : on résout d'abord l'école du membership ciblé.
      const target = await ctx.db.query.schoolMemberships.findFirst({
        where: eq(schoolMemberships.id, membershipId),
      });
      if (!target) {
        throw new GraphQLError('Membre introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const user = requireSchoolAdmin(ctx, target.schoolId);

      const [updated] = await ctx.db
        .update(schoolMemberships)
        .set({ status })
        .where(eq(schoolMemberships.id, membershipId))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    target.schoolId,
        actorId:     user.membershipId!,
        action:      'USER_ROLE_CHANGED',
        entityType:  'membership',
        entityId:    membershipId,
        oldValue:    { status: target.status },
        newValue:    { status },
        description: `Membership mis à jour → ${status}`,
      });

      return updated;
    },
  },
};

