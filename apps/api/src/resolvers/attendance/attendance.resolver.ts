import { eq, and, count, isNull, inArray } from 'drizzle-orm';
import { attendances, classSubjects, notifications, parentStudents, students, schools, schoolMemberships } from '../../db/schema';
import { requireAdminOrTeacher, requireSchoolMember } from '../../middleware/permissions';
import { MarkAttendanceSchema } from '../../utils/validators/schemas';
import { auditService } from '../../services/audit.service';
import { pubsub }       from '../../pubsub';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../middleware/auth';
import { emailService } from '../../services/email.service';

const attendanceRelations = {
  student:      { with: { membership: { with: { profile: true } } } },
  markedBy:     { with: { profile: true } },
  classSubject: { with: { subject: true } },
} as const;

async function loadAttendancesByIds(ctx: GraphQLContext, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await ctx.db.query.attendances.findMany({
    where: inArray(attendances.id, ids),
    with:  attendanceRelations,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export const attendanceResolvers = {
  Query: {
    attendanceByClassSubject: async (
      _: unknown,
      args: { classSubjectId: string; date: string },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      const cs = await ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, args.classSubjectId),
        with: { class: true },
      });
      if (!cs) {
        throw new GraphQLError('Association introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      requireSchoolMember(ctx, (cs as any).class.schoolId);
      return ctx.db.query.attendances.findMany({
        where: and(
          eq(attendances.classSubjectId, args.classSubjectId),
          eq(attendances.date, args.date.split('T')[0]),
          isNull(attendances.deletedAt),
        ),
        with: {
          student: { with: { membership: { with: { profile: true } } } },
          markedBy: { with: { profile: true } },
        },
      });
    },

    attendanceByStudent: async (
      _: unknown,
      args: {
        filter: { studentId?: string; classSubjectId?: string; statut?: string; startDate?: string; endDate?: string };
        pagination?: { page: number; limit: number };
      },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule, ET si
      // aucun filtre n'était fourni, la requête renvoyait les présences de
      // TOUS les élèves de TOUTES les écoles de la plateforme. Corrigé : un
      // filtre (studentId ou classSubjectId) est désormais obligatoire, et
      // scopé à l'école/élève concerné.
      if (!args.filter.studentId && !args.filter.classSubjectId) {
        throw new GraphQLError(
          'Un filtre studentId ou classSubjectId est requis.',
          { extensions: { code: 'BAD_USER_INPUT' } }
        );
      }
      if (args.filter.studentId) {
        const student = await ctx.db.query.students.findFirst({
          where: eq(students.id, args.filter.studentId),
          with: { class: true },
        });
        if (!student) throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
        requireSchoolMember(ctx, (student as any).class.schoolId);
      } else if (args.filter.classSubjectId) {
        const cs = await ctx.db.query.classSubjects.findFirst({
          where: eq(classSubjects.id, args.filter.classSubjectId),
          with: { class: true },
        });
        if (!cs) throw new GraphQLError('Association introuvable', { extensions: { code: 'NOT_FOUND' } });
        requireSchoolMember(ctx, (cs as any).class.schoolId);
      }

      const page   = args.pagination?.page  ?? 1;
      const limit  = args.pagination?.limit ?? 30;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (args.filter.studentId)      conditions.push(eq(attendances.studentId,      args.filter.studentId));
      if (args.filter.classSubjectId) conditions.push(eq(attendances.classSubjectId, args.filter.classSubjectId));
      if (args.filter.statut)         conditions.push(eq(attendances.statut,         args.filter.statut as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

      const where = and(...conditions);

      const [data, total] = await Promise.all([
        ctx.db.query.attendances.findMany({
          where,
          limit,
          offset,
          orderBy: (a, { desc }) => [desc(a.date)],
          with: {
            classSubject: { with: { subject: true } },
            markedBy: { with: { profile: true } },
          },
        }),
        ctx.db.select({ count: count() }).from(attendances).where(where),
      ]);

      const totalCount = Number(total[0]?.count ?? 0);
      return {
        data,
        pageInfo: {
          hasNextPage:     offset + limit < totalCount,
          hasPreviousPage: page > 1,
          totalCount,
          currentPage:     page,
          totalPages:      Math.max(1, Math.ceil(totalCount / limit)),
        },
      };
    },
  },

  Mutation: {
    markAttendance: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const user  = requireAdminOrTeacher(ctx);
      let input;
      try {
        input = MarkAttendanceSchema.parse(args.input);
      } catch {
        throw new GraphQLError('Données de présence invalides.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const date  = input.date.split('T')[0];

      // Dérive l'école depuis la classe/matière ciblée puis vérifie que
      // l'acteur y appartient bien (ou est SUPER_ADMIN) — remplace l'ancien
      // `user.schoolId!` qui plantait silencieusement l'audit pour un
      // SUPER_ADMIN non rattaché à une école.
      const targetClassSubject = await ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, input.classSubjectId),
        with: { class: true, subject: true },
      });
      if (!targetClassSubject) {
        throw new GraphQLError('Classe/matière introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const targetSchoolId = (targetClassSubject as any).class.schoolId;
      requireSchoolMember(ctx, targetSchoolId);

      if (!user.membershipId) {
        throw new GraphQLError(
          'Impossible d\'enregistrer les présences : compte non rattaché à un établissement.',
          { extensions: { code: 'FORBIDDEN' } }
        );
      }

      const school = await ctx.db.query.schools.findFirst({
        where: eq(schools.id, targetSchoolId),
      });
      const subjectName = (targetClassSubject as any).subject?.nom ?? 'cours';

      const results = [];
      const notificationsToCreate = [];

      for (const record of input.records) {
        // Upsert : si présence déjà marquée aujourd'hui → update, sinon insert
        const existing = await ctx.db.query.attendances.findFirst({
          where: and(
            eq(attendances.studentId,      record.studentId),
            eq(attendances.classSubjectId, input.classSubjectId),
            eq(attendances.date,           date),
          ),
        });

        let att;
        if (existing) {
          [att] = await ctx.db
            .update(attendances)
            .set({
              statut:    record.statut,
              motif:     record.motif ?? null,
              deletedAt: null,
              isActive:  true,
              updatedAt: new Date(),
            })
            .where(eq(attendances.id, existing.id))
            .returning();
        } else {
          [att] = await ctx.db
            .insert(attendances)
            .values({
              studentId:      record.studentId,
              classSubjectId: input.classSubjectId,
              date,
              statut:         record.statut,
              motif:          record.motif ?? null,
              markedById:     user.membershipId,
            })
            .returning();
        }
        if (!att?.id) continue;
        results.push(att);

        if (record.statut === 'ABSENT' || record.statut === 'RETARD') {
          try {
            const parentLinks = await ctx.db.query.parentStudents.findMany({
              where: eq(parentStudents.studentId, record.studentId),
              with: {
                parent: { with: { profile: true } },
                student: { with: { membership: { with: { profile: true } } } },
              },
            });

            for (const link of parentLinks) {
              const parentProfile = (link as any).parent?.profile;
              if (!parentProfile?.id) continue;

              const studentName = `${(link as any).student?.membership?.profile?.prenom ?? ''} ${(link as any).student?.membership?.profile?.nom ?? ''}`.trim() || 'Élève';
              const statutLabel = record.statut === 'ABSENT' ? 'absent(e)' : 'en retard';

              notificationsToCreate.push({
                profileId: parentProfile.id,
                schoolId:  targetSchoolId,
                titre:     `⚠️ ${record.statut === 'ABSENT' ? 'Absence' : 'Retard'} signalé(e)`,
                message:   `${studentName} a été marqué(e) ${statutLabel} en ${subjectName} le ${new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.`,
                type:      'ABSENCE' as const,
              });

              if (record.statut === 'ABSENT' && parentProfile.email) {
                emailService.sendAbsenceNotification({
                  to:             parentProfile.email,
                  parentPrenom:   parentProfile.prenom ?? 'Parent',
                  studentPrenom:  studentName,
                  date,
                  matiere:        subjectName,
                  schoolName:     school?.nom ?? 'sulungukutu',
                }).catch((err) => console.error('[Email absence]', err));
              }
            }
          } catch (err) {
            console.error('[Attendance] notification parent ignorée :', err);
          }
        }
      }

      if (notificationsToCreate.length > 0) {
        try {
          const inserted = await ctx.db.insert(notifications).values(notificationsToCreate).returning();
          for (const notif of inserted) {
            pubsub.publish('NOTIFICATION_ADDED', notif.profileId, {
              notificationAdded: notif,
            });
          }
        } catch (err) {
          console.error('[Attendance] notifications non envoyées :', err);
        }
      }

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'ATTENDANCE_MARKED',
        entityType:  'attendance',
        entityId:    input.classSubjectId,
        description: `Présences marquées : ${input.records.length} élèves`,
      });

      const hydrated = await loadAttendancesByIds(
        ctx,
        results.map((att) => att.id).filter(Boolean)
      );

      for (const att of hydrated) {
        pubsub.publish('ATTENDANCE_UPDATED', input.classSubjectId, {
          attendanceUpdated: att,
        });
      }

      return hydrated;
    },

    updateAttendance: async (
      _: unknown,
      args: { id: string; input: { statut: string; motif?: string } },
      ctx: GraphQLContext
    ) => {
      const user = requireAdminOrTeacher(ctx);

      const existing = await ctx.db.query.attendances.findFirst({
        where: eq(attendances.id, args.id),
        with: { classSubject: { with: { class: true } } },
      });
      if (!existing) {
        throw new GraphQLError('Présence introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const targetSchoolId = (existing as any).classSubject.class.schoolId;
      requireSchoolMember(ctx, targetSchoolId);

      const [updated] = await ctx.db
        .update(attendances)
        .set({ statut: args.input.statut as any, motif: args.input.motif, updatedAt: new Date() }) // eslint-disable-line @typescript-eslint/no-explicit-any
        .where(eq(attendances.id, args.id))
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'ATTENDANCE_UPDATED',
        entityType:  'attendance',
        entityId:    args.id,
        newValue:    { statut: args.input.statut },
      });

      const [hydrated] = await loadAttendancesByIds(ctx, [updated.id]);
      return hydrated ?? updated;
    },
  },

  Attendance: {
    date: (parent: { date?: string | Date | null }) => {
      if (!parent.date) return null;
      if (typeof parent.date === 'string') return parent.date.slice(0, 10);
      if (parent.date instanceof Date && !Number.isNaN(parent.date.getTime())) {
        const y = parent.date.getFullYear();
        const m = String(parent.date.getMonth() + 1).padStart(2, '0');
        const d = String(parent.date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return String(parent.date).slice(0, 10);
    },
    student: async (parent: { student?: unknown; studentId?: string }, _: unknown, ctx: GraphQLContext) => {
      if (parent.student) return parent.student;
      if (!parent.studentId) return null;
      return ctx.db.query.students.findFirst({
        where: eq(students.id, parent.studentId),
        with: { membership: { with: { profile: true } } },
      });
    },
    classSubject: async (parent: { classSubject?: unknown; classSubjectId?: string }, _: unknown, ctx: GraphQLContext) => {
      if (parent.classSubject) return parent.classSubject;
      if (!parent.classSubjectId) return null;
      return ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, parent.classSubjectId),
        with: { subject: true, class: true },
      });
    },
    markedBy: async (parent: { markedBy?: unknown; markedById?: string }, _: unknown, ctx: GraphQLContext) => {
      if (parent.markedBy) return parent.markedBy;
      if (!parent.markedById) return null;
      return ctx.db.query.schoolMemberships.findFirst({
        where: eq(schoolMemberships.id, parent.markedById),
        with: { profile: true },
      });
    },
  },
};

