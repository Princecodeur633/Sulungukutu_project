import { generateTempPassword } from '../../utils/password';
import { normalizePhone } from '../../utils/phone';
import { withFriendlyUniqueError } from '../../utils/db-errors';
import bcrypt from 'bcryptjs';
import { and, count, eq, ilike, sql, isNull, or } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import {
  students, globalProfiles, schoolMemberships,
  parentStudents, payments, notifications, attendances, schools, classes, bulletins,
} from '../../db/schema';
import { requireSchoolMember, requireAdminOrTeacher, requireSchoolAdmin, requireStudentAccess } from '../../middleware/permissions';
import { CreateStudentSchema } from '../../utils/validators/schemas';
import { generateMatricule } from '../../utils/code-generator';
import { paymentService } from '../../services/payment.service';
import { emailService } from '../../services/email.service';
import { auditService } from '../../services/audit.service';
import { identityService } from '../../services/identity.service';
import type { StudentData, ParentStudentData, AttendanceData } from '../../types/domain';
import type { GraphQLContext } from '../../middleware/auth';

export const studentResolvers = {
  Query: {
    studentsByClass: async (
      _: unknown,
      args: { classId: string; pagination?: { page: number; limit: number } },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule — un
      // utilisateur de N'IMPORTE QUELLE école pouvait lister les élèves
      // d'une classe d'une AUTRE école en devinant/énumérant un classId.
      const targetClass = await ctx.db.query.classes.findFirst({ where: eq(classes.id, args.classId) });
      if (!targetClass) {
        throw new GraphQLError('Classe introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      requireSchoolMember(ctx, targetClass.schoolId);

      const page   = args.pagination?.page  ?? 1;
      const limit  = args.pagination?.limit ?? 30;
      const offset = (page - 1) * limit;

      // Les élèves "soft-deleted" ne sont plus listés par défaut.
      const whereClause = and(eq(students.classId, args.classId), isNull(students.deletedAt));

      const [data, total] = await Promise.all([
        ctx.db.query.students.findMany({
          where:   whereClause,
          limit,
          offset,
          orderBy: (s, { asc }) => [asc(s.matricule)],
          with: {
            membership: { with: { profile: true } },
            parents:    { with: { parent: { with: { profile: true } } } },
            class:      { with: { level: true } },
          },
        }),
        ctx.db.select({ count: count() }).from(students).where(whereClause),
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

    studentsBySchool: async (
      _: unknown,
      args: { schoolId: string; pagination?: { page: number; limit: number } },
      ctx: GraphQLContext
    ) => {
      requireSchoolMember(ctx, args.schoolId);
      const page   = args.pagination?.page  ?? 1;
      const limit  = args.pagination?.limit ?? 30;
      const offset = (page - 1) * limit;

      // Récupérer les memberships STUDENT de cette école
      const membershipIds = await ctx.db.query.schoolMemberships.findMany({
        where: and(
          eq(schoolMemberships.schoolId, args.schoolId),
          eq(schoolMemberships.role, 'STUDENT'),
        ),
        columns: { id: true },
      });
      const ids = membershipIds.map((m) => m.id);

      // Avant : `offset` n'était jamais transmis à la requête — la
      // pagination était cassée (la page 2 renvoyait les mêmes résultats
      // que la page 1). Corrigé, et exclusion des élèves soft-deleted.
      const whereClause = and(
        sql`${students.membershipId} = ANY(${ids})`,
        isNull(students.deletedAt)
      );
      const data = await ctx.db.query.students.findMany({
        where:   whereClause,
        limit,
        offset,
        with: {
          membership: { with: { profile: true } },
          class:      { with: { level: true } },
          parents:    { with: { parent: { with: { profile: true } } } },
        },
      });

      return {
        data,
        pageInfo: {
          hasNextPage:     offset + limit < ids.length,
          hasPreviousPage: page > 1,
          totalCount:      ids.length,
          currentPage:     page,
          totalPages:      Math.ceil(ids.length / limit),
        },
      };
    },

    studentById: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.id),
        with: { class: true },
      });
      if (!student) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      // Avant : requireSchoolMember(ctx, '') = authentification seule — un
      // utilisateur de N'IMPORTE QUELLE école pouvait consulter le dossier
      // complet (notes, paiements, bulletins) de N'IMPORTE QUEL élève.
      await requireStudentAccess(ctx, args.id, (student as any).class.schoolId);
      return ctx.db.query.students.findFirst({
        where: eq(students.id, args.id),
        with: {
          membership: { with: { profile: true } },
          class:      { with: { level: true } },
          parents:    { with: { parent: { with: { profile: true } } } },
          payments:   true,
          bulletins:  true,
        },
      });
    },

    myStudentProfile: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      const user = requireSchoolMember(ctx, args.schoolId);
      return ctx.db.query.students.findFirst({
        where: eq(students.membershipId, user.membershipId!),
        with: {
          membership: { with: { profile: true } },
          class:      { with: { level: true } },
          parents:    { with: { parent: { with: { profile: true } } } },
        },
      });
    },


    attendanceSummary: async (
      _: unknown,
      args: { studentId: string; anneeScolaire: string },
      ctx: GraphQLContext
    ) => {
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.studentId),
        with: { class: true },
      });
      if (!student) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      await requireStudentAccess(ctx, args.studentId, (student as any).class.schoolId);
      // Group absences by month for this student/year
      const rows = await ctx.db.query.attendances.findMany({
        where: and(
          eq(attendances.studentId, args.studentId),
          eq(attendances.statut, 'ABSENT'),
        ),
      });
      // Aggregate by month number
      const byMonth: Record<number, number> = {};
      for (const row of rows) {
        const month = new Date(row.date).getMonth() + 1; // 1-12
        byMonth[month] = (byMonth[month] ?? 0) + 1;
      }
      // Return as AbsenceMonthStat (just the last requested month for now)
      const mois = new Date().getMonth() + 1;
      return { mois, count: byMonth[mois] ?? 0 };
    },

    studentStats: async (
      _: unknown,
      args: { studentId: string; anneeScolaire: string },
      ctx: GraphQLContext
    ) => {
      const statsStudent = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.studentId),
        with: { class: true },
      });
      if (!statsStudent) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      await requireStudentAccess(ctx, args.studentId, (statsStudent as any).class.schoolId);
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.studentId),
        with: {
          membership: { with: { profile: true } },
          class: true,
          grades: {
            where: (g, { isNull: n }) => n(g.deletedAt),
            with: { classSubject: { with: { subject: true } } },
          },
          attendances: true,
        },
      });

      if (!student) throw new GraphQLError('Élève introuvable');

      // Calculer les moyennes par matière et trimestre
      const gradesByCS: Record<string, Record<string, number[]>> = {};
      for (const g of (student as StudentData).grades ?? []) {
        const csId = g.classSubjectId;
        const trim = g.trimestre;
        if (!gradesByCS[csId]) gradesByCS[csId] = {};
        if (!gradesByCS[csId][trim]) gradesByCS[csId][trim] = [];
        gradesByCS[csId][trim].push(Number(g.valeur));
      }

      const moyennesParMatiere = [];
      for (const [csId, trims] of Object.entries(gradesByCS)) {
        const cs = ((student as any).grades as any[] ?? []).find((g: { classSubjectId: string; classSubject?: unknown }) => g.classSubjectId === csId)?.classSubject; // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const [trim, vals] of Object.entries(trims)) {
          const moy = vals.reduce((a, b) => a + b, 0) / vals.length;
          moyennesParMatiere.push({ classSubject: cs, moyenne: moy, trimestre: trim });
        }
      }

      // Moyennes par trimestre
      const trimTotals: Record<string, { sum: number; count: number }> = {};
      for (const m of moyennesParMatiere) {
        if (!trimTotals[m.trimestre]) trimTotals[m.trimestre] = { sum: 0, count: 0 };
        trimTotals[m.trimestre].sum   += m.moyenne;
        trimTotals[m.trimestre].count += 1;
      }
      const moyennesParTrimestre = Object.entries(trimTotals).map(([t, v]) => ({
        trimestre: t,
        moyenne:   v.sum / v.count,
      }));

      const latestBulletin = await ctx.db.query.bulletins.findFirst({
        where: and(
          eq(bulletins.studentId, args.studentId),
          eq(bulletins.anneeScolaire, args.anneeScolaire),
          isNull(bulletins.deletedAt),
        ),
        orderBy: (b, { desc }) => [desc(b.generatedAt)],
      });

      // Absences par mois
      const absByMonth: Record<number, number> = {};
      for (const a of ((student as any).attendances as any[] ?? [])) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (a.statut === 'ABSENT') {
          const m = new Date(a.date).getMonth() + 1;
          absByMonth[m] = (absByMonth[m] ?? 0) + 1;
        }
      }
      const absencesParMois = Object.entries(absByMonth).map(([mois, count]) => ({
        mois: Number(mois), count,
      }));

      return {
        student,
        moyennesParMatiere,
        moyennesParTrimestre,
        absencesParMois,
        rang:    latestBulletin?.rang ?? null,
        mention: latestBulletin?.mention ?? null,
      };
    },

    searchStudents: async (
      _: unknown,
      args: { schoolId: string; query: string },
      ctx: GraphQLContext
    ) => {
      requireSchoolMember(ctx, args.schoolId);
      // Recherche par nom/prénom via les profils
      const profiles = await ctx.db.query.globalProfiles.findMany({
        where: sql`
          (${globalProfiles.nom} ILIKE ${`%${args.query}%`} OR
           ${globalProfiles.prenom} ILIKE ${`%${args.query}%`} OR
           ${globalProfiles.email} ILIKE ${`%${args.query}%`})
        `,
        limit: 20,
        with: { memberships: { where: and(
          eq(schoolMemberships.schoolId, args.schoolId),
          eq(schoolMemberships.role, 'STUDENT'),
        )} },
      });

      const membershipIds = profiles
        .flatMap((p: { memberships?: Array<{ id: string }> }) => p.memberships ?? [])
        .map((m: { id: string }) => m.id);

      if (membershipIds.length === 0) return [];

      return ctx.db.query.students.findMany({
        where: sql`${students.membershipId} = ANY(${membershipIds})`,
        with: {
          membership: { with: { profile: true } },
          class: true,
        },
        limit: 20,
      });
    },
  },

  Mutation: {
    createStudent: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      // Avant : requireAdmin(ctx) seul — un admin de N'IMPORTE QUELLE école
      // pouvait créer un élève directement dans une AUTRE école simplement
      // en passant son schoolId dans l'input. Corrigé.
      const targetSchoolId = String(args.input.schoolId ?? '');
      const user  = requireSchoolAdmin(ctx, targetSchoolId);
      const input = CreateStudentSchema.parse(args.input);

      // ── 0. Récupérer l'établissement (nécessaire pour l'Identity Service :
      // l'email interne intègre le code école, garantissant l'isolation
      // multi-tenant même en cas d'homonymes entre deux établissements) ──
      const school = await ctx.db.query.schools.findFirst({
        where: eq(schools.id, input.schoolId),
      });
      const anneeScolaire = school?.anneeScolaire ?? '2024-2025';

      // ── 1. Créer ou récupérer le profil global de l'élève ──
      // Avant : recherche par email uniquement. Beaucoup d'utilisateurs
      // (élèves, parents) n'ont pas d'email distinct mais ont un téléphone
      // — on reconnaît désormais aussi une personne déjà enregistrée par
      // son numéro (normalisé : espaces/tirets/préfixe +242 ignorés).
      const normalizedStudentPhone = input.phone ? normalizePhone(input.phone) : null;
      let studentProfile = (input.email || normalizedStudentPhone)
        ? await ctx.db.query.globalProfiles.findFirst({
            where: or(
              input.email ? eq(globalProfiles.email, input.email) : undefined,
              normalizedStudentPhone
                ? sql`regexp_replace(${globalProfiles.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedStudentPhone.slice(-8)}`
                : undefined,
            ),
          })
        : null;

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const studentProfileWasCreated = !studentProfile;

      // Identity Service : génère un identifiant de connexion unique et,
      // si aucun email n'a été fourni, un email interne normalisé et
      // garanti unique (plutôt que la précédente logique ad hoc
      // `${code.toLowerCase()}@edu.local`, sans contrôle de collision réel).
      const studentIdentity = await identityService.createIdentity(ctx.db, {
        role: 'STUDENT',
        nom: input.nom,
        prenom: input.prenom,
        schoolId: input.schoolId,
        schoolCode: school?.code ?? input.schoolId,
        explicitEmail: input.email ?? null,
        actorMembershipId: user.membershipId,
      });

      if (!studentProfile) {
        const [created] = await withFriendlyUniqueError(() => ctx.db
          .insert(globalProfiles)
          .values({
            code:         studentIdentity.code,
            nom:          input.nom,
            prenom:       input.prenom,
            email:        studentIdentity.email,
            phone:        input.phone,
            passwordHash,
          })
          .returning());
        studentProfile = created;
      }

      // ── 2. Créer le membership STUDENT ────────────────────
      const membershipCode = await identityService.generateUniqueLoginCode(ctx.db, 'STUDENT', input.nom, input.prenom);
      const [membership] = await ctx.db
        .insert(schoolMemberships)
        .values({
          profileId: studentProfile.id,
          schoolId:  input.schoolId,
          role:      'STUDENT',
          code:      membershipCode,
          status:    'ACTIVE',
        })
        .returning();

      // ── 4. Compter les élèves pour le matricule ─────────────
      const [{ count: studentCount }] = await ctx.db
        .select({ count: count() }).from(students);

      const matricule = generateMatricule(
        anneeScolaire,
        input.nom,
        input.prenom,
        Number(studentCount) + 1
      );

      // ── 5. Créer le profil étudiant ────────────────────────
      const [newStudent] = await ctx.db
        .insert(students)
        .values({
          membershipId:  membership.id,
          classId:       input.classId,
          matricule,
          dateNaissance: input.dateNaissance,
          sexe:          input.sexe as 'M' | 'F' | undefined,
        })
        .returning();

      // ── 6. Initialiser les 9 paiements ─────────────────────
      await paymentService.initializePayments(ctx.db, newStudent.id, anneeScolaire);

      // ── 7. Envoyer l’invitation à l’élève si un email est fourni
      if (input.email) {
        await emailService.sendInvitation({
          to:          input.email,
          prenom:      input.prenom,
          nom:         input.nom,
          role:        'STUDENT',
          schoolName:  school?.nom ?? input.schoolId,
          tempPassword,
        }).catch(() => {});
      }

      // ── 7. Créer/lier le parent si fourni ──────────────────
      // Avant : recherche ET condition d'entrée basées sur l'email
      // uniquement (`if (input.parentEmail)`) — un parent qui n'avait
      // qu'un numéro de téléphone n'était JAMAIS lié ni créé. Corrigé :
      // le téléphone seul suffit désormais à identifier/créer le parent,
      // et sert aussi à reconnaître un parent déjà enregistré pour un
      // autre enfant (même numéro, email éventuellement différent/absent).
      let parentTempPassword: string | null = null;
      if (input.parentEmail || input.parentPhone) {
        const normalizedParentPhone = input.parentPhone ? normalizePhone(input.parentPhone) : null;
        let parentProfile = await ctx.db.query.globalProfiles.findFirst({
          where: or(
            input.parentEmail ? eq(globalProfiles.email, input.parentEmail) : undefined,
            normalizedParentPhone
              ? sql`regexp_replace(${globalProfiles.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedParentPhone.slice(-8)}`
              : undefined,
          ),
        });

        if (!parentProfile) {
          const parentPwd  = generateTempPassword();
          const parentHash = await bcrypt.hash(parentPwd, 12);
          parentTempPassword = parentPwd;
          const parentCode = await identityService.generateUniqueLoginCode(
            ctx.db, 'PARENT', input.parentNom ?? 'Parent', input.parentPrenom ?? ''
          );
          const [created] = await withFriendlyUniqueError(async () => ctx.db
            .insert(globalProfiles)
            .values({
              code:         parentCode,
              nom:          input.parentNom ?? 'Parent',
              prenom:       input.parentPrenom ?? '',
              // Un parent sans email personnel obtient lui aussi un email
              // interne (via l'Identity Service), jamais une chaîne vide.
              email:        input.parentEmail
                ?? (await identityService.generateUniqueInternalEmail(
                      ctx.db, input.parentNom ?? 'Parent', input.parentPrenom ?? '', school?.code ?? input.schoolId
                    )).email,
              phone:        input.parentPhone,
              passwordHash: parentHash,
            })
            .returning());
          parentProfile = created;
        }

        // Membership parent dans cette école
        const existingParentMembership = await ctx.db.query.schoolMemberships.findFirst({
          where: and(
            eq(schoolMemberships.profileId, parentProfile.id),
            eq(schoolMemberships.schoolId, input.schoolId),
            eq(schoolMemberships.role, 'PARENT'),
          ),
        });

        let parentMembership = existingParentMembership;
        if (!parentMembership) {
          const pCode = await identityService.generateUniqueLoginCode(
            ctx.db, 'PARENT', input.parentNom ?? 'Parent', input.parentPrenom ?? ''
          );
          const [pm] = await ctx.db
            .insert(schoolMemberships)
            .values({
              profileId: parentProfile.id,
              schoolId:  input.schoolId,
              role:      'PARENT',
              code:      pCode,
              status:    'ACTIVE',
            })
            .returning();
          parentMembership = pm;
        }

        // Lien parent ↔ élève
        await ctx.db.insert(parentStudents).values({
          parentMembershipId: parentMembership.id,
          studentId:          newStudent.id,
          lien:               (input.parentLien ?? "TUTEUR") as 'PERE' | 'MERE' | 'TUTEUR',
        });

        // ── Email au parent (seulement s'il a un email réel) ────

        if (input.parentEmail && parentTempPassword) {
          // Nouveau compte parent : on envoie EXACTEMENT le mot de passe qui
          // a été haché et enregistré plus haut (`parentTempPassword`).
          //
          // BUG CORRIGÉ : le code précédent générait ICI un second mot de
          // passe aléatoire (`generateTempPassword()`) pour l'email, sans
          // jamais l'enregistrer en base — le parent recevait donc un mot
          // de passe qui ne correspondait à rien, et ne pouvait jamais se
          // connecter avec. C'est très probablement la cause du problème
          // « email ou mot de passe incorrect » à la connexion.
          await emailService.sendInvitation({
            to:          input.parentEmail,
            prenom:      input.parentPrenom ?? 'Parent',
            nom:         input.parentNom ?? '',
            role:        'PARENT',
            schoolName:  school?.nom ?? input.schoolId,
            tempPassword: parentTempPassword!,
          }).catch(() => {});
        } else if (input.parentEmail) {
          // Parent qui a déjà un compte (que ce soit un autre enfant dans
          // cette même école, ou un premier enfant ici mais un compte
          // ouvert via une autre école) : on NE génère PAS de nouveau mot
          // de passe — celui qu'il connaît déjà continue de fonctionner.
          // On l'informe simplement qu'un enfant supplémentaire est
          // rattaché à son compte.
          await emailService.sendChildAdded({
            to:          input.parentEmail,
            prenom:      parentProfile.prenom,
            nom:         parentProfile.nom,
            childPrenom: input.prenom,
            childNom:    input.nom,
            schoolName:  school?.nom ?? input.schoolId,
          }).catch(() => {});
        }
      }

      await auditService.log(ctx.db, {
        schoolId:    input.schoolId,
        actorId:     user.membershipId!,
        action:      'USER_CREATED',
        entityType:  'student',
        entityId:    newStudent.id,
        description: `Élève inscrit : ${input.prenom} ${input.nom} (${matricule})`,
      });

      const createdStudent = await ctx.db.query.students.findFirst({
        where: eq(students.id, newStudent.id),
        with: {
          membership: { with: { profile: true } },
          class: true,
          parents: { with: { parent: { with: { profile: true } } } },
        },
      });

      return createdStudent ? {
        ...createdStudent,
        tempPassword,
        parentTempPassword,
      } : null;
    },

    updateStudent: async (
      _: unknown,
      args: { id: string; input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      // NOTE: auparavant `requireAdmin(ctx)` seul — n'importe quel ADMIN,
      // de n'importe quelle école, pouvait modifier n'importe quel élève.
      // On vérifie maintenant que l'élève appartient bien à une école que
      // l'acteur administre (ou que l'acteur est SUPER_ADMIN).
      const target = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.id),
        with: { class: true },
      });
      if (!target) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const user = requireSchoolAdmin(ctx, (target as any).class.schoolId);
      const [updated] = await ctx.db
        .update(students).set(args.input).where(eq(students.id, args.id)).returning();

      await auditService.log(ctx.db, {
        schoolId:    (target as any).class.schoolId,
        actorId:     user.membershipId,
        action:      'USER_UPDATED',
        entityType:  'student',
        entityId:    args.id,
        description: 'Élève modifié',
      });
      return updated;
    },

    deleteStudent: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      // Résoudre l'école AVANT suppression (la ligne n'existera plus après).
      const target = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.id),
        with: { class: true },
      });
      if (!target) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const user = requireSchoolAdmin(ctx, (target as any).class.schoolId);
      // Avant : DELETE physique — effaçait définitivement l'historique de
      // notes/paiements/présences de l'élève en cas d'erreur de manipulation.
      // Corrigé : soft delete, restaurable, rien n'est jamais perdu.
      await ctx.db
        .update(students)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(students.id, args.id));
      await auditService.log(ctx.db, {
        schoolId:    (target as any).class.schoolId,
        actorId:     user.membershipId,
        action:      'USER_DELETED',
        entityType:  'student',
        entityId:    args.id,
        description: 'Élève désactivé (soft delete)',
      });
      return true;
    },

    restoreStudent: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const target = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.id),
        with: { class: true },
      });
      if (!target) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const user = requireSchoolAdmin(ctx, (target as any).class.schoolId);
      await ctx.db
        .update(students)
        .set({ isActive: true, deletedAt: null })
        .where(eq(students.id, args.id));
      await auditService.log(ctx.db, {
        schoolId:    (target as any).class.schoolId,
        actorId:     user.membershipId,
        action:      'USER_UPDATED',
        entityType:  'student',
        entityId:    args.id,
        description: 'Élève restauré',
      });
      return true;
    },

    transferStudentClass: async (
      _: unknown,
      args: { studentId: string; newClassId: string },
      ctx: GraphQLContext
    ) => {
      // Avant : requireAdmin(ctx) seul, aucune vérification que newClassId
      // appartient à la même école que l'élève — un admin d'une école
      // pouvait transférer un élève vers une classe d'une AUTRE école,
      // corrompant l'isolation multi-tenant. Corrigé.
      const target = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.studentId),
        with: { class: true },
      });
      if (!target) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const schoolId = (target as any).class.schoolId;
      const user = requireSchoolAdmin(ctx, schoolId);

      const newClass = await ctx.db.query.classes.findFirst({ where: eq(classes.id, args.newClassId) });
      if (!newClass) {
        throw new GraphQLError('Classe de destination introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      if (newClass.schoolId !== schoolId) {
        throw new GraphQLError(
          "Impossible de transférer un élève vers une classe d'un autre établissement.",
          { extensions: { code: 'FORBIDDEN' } }
        );
      }

      const [updated] = await ctx.db
        .update(students)
        .set({ classId: args.newClassId })
        .where(eq(students.id, args.studentId))
        .returning();

      await auditService.log(ctx.db, {
        schoolId,
        actorId:     user.membershipId,
        action:      'USER_UPDATED',
        entityType:  'student',
        entityId:    args.studentId,
        oldValue:    { classId: (target as any).classId },
        newValue:    { classId: args.newClassId },
        description: `Élève transféré vers la classe "${newClass.nom}"`,
      });

      return updated;
    },

    linkParentStudent: async (
      _: unknown,
      args: { input: { parentMembershipId: string; studentId: string; lien: string } },
      ctx: GraphQLContext
    ) => {
      // Avant : requireAdmin(ctx) seul — aucune vérification que le parent
      // ET l'élève appartiennent bien à l'école de l'admin appelant, ni
      // même qu'ils appartiennent à la MÊME école entre eux. Corrigé.
      const target = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.input.studentId),
        with: { class: true },
      });
      if (!target) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const schoolId = (target as any).class.schoolId;
      const user = requireSchoolAdmin(ctx, schoolId);

      const parentMembership = await ctx.db.query.schoolMemberships.findFirst({
        where: eq(schoolMemberships.id, args.input.parentMembershipId),
      });
      if (!parentMembership || parentMembership.role !== 'PARENT') {
        throw new GraphQLError('Parent introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      if (parentMembership.schoolId !== schoolId) {
        throw new GraphQLError(
          "Impossible de rattacher un parent et un élève d'établissements différents.",
          { extensions: { code: 'FORBIDDEN' } }
        );
      }

      const [link] = await ctx.db
        .insert(parentStudents)
        .values({
          parentMembershipId: args.input.parentMembershipId,
          studentId:          args.input.studentId,
          lien:               args.input.lien as 'PERE' | 'MERE' | 'TUTEUR',
        })
        .onConflictDoNothing()
        .returning();

      if (!link) {
        throw new GraphQLError('Ce parent est déjà rattaché à cet élève.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      await auditService.log(ctx.db, {
        schoolId,
        actorId:     user.membershipId,
        action:      'USER_UPDATED',
        entityType:  'parentStudent',
        entityId:    link.id,
        newValue:    { parentMembershipId: args.input.parentMembershipId, studentId: args.input.studentId, lien: args.input.lien },
        description: 'Parent rattaché à un élève',
      });

      return link;
    },

    unlinkParentStudent: async (
      _: unknown,
      args: { parentMembershipId: string; studentId: string },
      ctx: GraphQLContext
    ) => {
      // Avant : requireAdmin(ctx) seul — un admin de n'importe quelle école
      // pouvait détacher n'importe quel lien parent/élève. Corrigé.
      const target = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.studentId),
        with: { class: true },
      });
      if (!target) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const schoolId = (target as any).class.schoolId;
      const user = requireSchoolAdmin(ctx, schoolId);

      await ctx.db.delete(parentStudents).where(
        and(
          eq(parentStudents.parentMembershipId, args.parentMembershipId),
          eq(parentStudents.studentId, args.studentId),
        )
      );

      await auditService.log(ctx.db, {
        schoolId,
        actorId:     user.membershipId,
        action:      'USER_UPDATED',
        entityType:  'parentStudent',
        entityId:    args.studentId,
        oldValue:    { parentMembershipId: args.parentMembershipId, studentId: args.studentId },
        description: 'Parent détaché d\'un élève',
      });

      return true;
    },
  },
};

