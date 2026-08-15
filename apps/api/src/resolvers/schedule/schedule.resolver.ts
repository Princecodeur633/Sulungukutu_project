import { eq, and, ne, inArray } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { schedules, classSubjects, classes, schoolMemberships } from '../../db/schema';
import {
  requireAdmin,
  requireSchoolMember,
  requireAdminOrTeacher,
  requireSchoolAdmin,
} from '../../middleware/permissions';
import type { GraphQLContext } from '../../middleware/auth';
import type { ClassSubjectData, ScheduleData } from '../../types/domain';
import { overlaps } from '../../utils/time-overlap';

export const scheduleResolvers = {
  Query: {
    scheduleByClass: async (
      _: unknown,
      args: { classId: string },
      ctx: GraphQLContext
    ) => {
      // NOTE: auparavant `requireSchoolMember(ctx, '')` — cette forme ne
      // vérifie QUE l'authentification, pas l'appartenance à l'école de la
      // classe demandée. N'importe quel utilisateur authentifié pouvait donc
      // consulter l'emploi du temps d'une classe d'un AUTRE établissement en
      // devinant/énumérant un classId. On résout maintenant l'école réelle
      // de la classe et on vérifie l'accès dessus.
      const targetClass = await ctx.db.query.classes.findFirst({ where: eq(classes.id, args.classId) });
      if (!targetClass) {
        throw new GraphQLError('Classe introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      requireSchoolMember(ctx, targetClass.schoolId);
      // Récupérer tous les classSubjects de la classe → leurs schedules
      const classSubs = await ctx.db.query.classSubjects.findMany({
        where: eq(classSubjects.classId, args.classId),
        with: {
          schedules: true,
          subject:   true,
          teacher:   { with: { profile: true } },
        },
      });
      // Aplatir avec les infos de la matière
      const result: ScheduleData[] = [];
      for (const cs of classSubs) {
        for (const s of (cs as any).schedules) {
          result.push({ ...s, classSubject: cs });
        }
      }
      return result.sort((a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut));
    },

    scheduleByTeacherMembership: async (
      _: unknown,
      args: { teacherMembershipId: string },
      ctx: GraphQLContext
    ) => {
      const membership = await ctx.db.query.schoolMemberships.findFirst({
        where: eq(schoolMemberships.id, args.teacherMembershipId),
      });
      if (!membership) {
        throw new GraphQLError('Enseignant introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      requireSchoolMember(ctx, membership.schoolId);

      const teacherSubs = await ctx.db.query.classSubjects.findMany({
        where: eq(classSubjects.teacherMembershipId, args.teacherMembershipId),
        with: { schedules: true, class: true, subject: true },
      });
      const result: ScheduleData[] = [];
      for (const cs of teacherSubs) {
        for (const s of (cs as any).schedules) {
          result.push({ ...s, classSubject: cs });
        }
      }
      return result.sort((a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut));
    },

    scheduleByTeacher: async (
      _: unknown,
      args: { schoolId: string },
      ctx: GraphQLContext
    ) => {
      const user = requireAdminOrTeacher(ctx);
      const teacherSubs = await ctx.db.query.classSubjects.findMany({
        where: eq(classSubjects.teacherMembershipId, user.membershipId!),
        with: {
          schedules: true,
          class:     true,
          subject:   true,
        },
      });
      const result: ScheduleData[] = [];
      for (const cs of teacherSubs) {
        for (const s of (cs as any).schedules) {
          result.push({ ...s, classSubject: cs });
        }
      }
      return result.sort((a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut));
    },
  },

  Mutation: {
    createSchedule: async (
      _: unknown,
      args: {
        input: {
          classSubjectId: string;
          jour:           number;
          heureDebut:     string;
          heureFin:       string;
          salle?:         string;
        };
      },
      ctx: GraphQLContext
    ) => {
      // Récupérer les autres créneaux du même enseignant ce jour-là
      const cs = await ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, args.input.classSubjectId),
        with: { class: true },
      });
      if (!cs) throw new GraphQLError('Matière introuvable');
      // Vérifie que l'acteur administre bien l'école de cette classe (ou est
      // SUPER_ADMIN) — auparavant `requireAdmin(ctx)` seul permettait à
      // n'importe quel admin de modifier l'emploi du temps d'une autre école.
      requireSchoolAdmin(ctx, (cs as any).class.schoolId);

      await checkConflict(ctx.db, {
        jour: args.input.jour,
        heureDebut: args.input.heureDebut,
        heureFin: args.input.heureFin,
        classSubjectId: args.input.classSubjectId,
        teacherMembershipId: (cs as any).teacherMembershipId,
        salle: args.input.salle,
        schoolId: (cs as any).class.schoolId,
        excludeId: undefined,
      });

      const [created] = await ctx.db
        .insert(schedules)
        .values(args.input)
        .returning();
      return ctx.db.query.schedules.findFirst({
        where: eq(schedules.id, created.id),
        with:  { classSubject: { with: { class: true, subject: true } } },
      });
    },

    updateSchedule: async (
      _: unknown,
      args: { id: string; input: { jour?: number; heureDebut?: string; heureFin?: string; salle?: string } },
      ctx: GraphQLContext
    ) => {
      // Charger le créneau existant pour avoir le classSubjectId et l'enseignant
      const existing = await ctx.db.query.schedules.findFirst({
        where: eq(schedules.id, args.id),
        with: { classSubject: { with: { class: true } } },
      });
      if (!existing) throw new GraphQLError('Créneau introuvable');
      requireSchoolAdmin(ctx, (existing.classSubject as any)?.class?.schoolId);

      const jour       = args.input.jour       ?? existing.jour;
      const heureDebut = args.input.heureDebut ?? existing.heureDebut;
      const heureFin   = args.input.heureFin   ?? existing.heureFin;
      const salle      = args.input.salle      ?? existing.salle ?? undefined;

      await checkConflict(ctx.db, {
        jour, heureDebut, heureFin,
        classSubjectId: existing.classSubjectId,
        teacherMembershipId: (existing.classSubject as any)?.teacherMembershipId,
        salle,
        schoolId: (existing.classSubject as any)?.class?.schoolId,
        excludeId: args.id,
      });

      const [updated] = await ctx.db
        .update(schedules)
        .set(args.input)
        .where(eq(schedules.id, args.id))
        .returning();
      return updated;
    },

    deleteSchedule: async (
      _: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      const existing = await ctx.db.query.schedules.findFirst({
        where: eq(schedules.id, args.id),
        with: { classSubject: { with: { class: true } } },
      });
      if (!existing) throw new GraphQLError('Créneau introuvable');
      requireSchoolAdmin(ctx, (existing.classSubject as any)?.class?.schoolId);

      await ctx.db.delete(schedules).where(eq(schedules.id, args.id));
      return true;
    },
  },
};

// ── Détection de conflits horaires ───────────────────────────
async function checkConflict(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any, // Drizzle DB instance — typed DB type not exported
  opts: {
    jour: number;
    heureDebut: string;
    heureFin: string;
    classSubjectId: string;
    teacherMembershipId?: string;
    salle?: string;
    schoolId?: string;
    excludeId?: string;
  }
) {
  // Récupérer tous les créneaux du même classSubject ce jour (sauf celui qu'on déplace)
  const existing = await db.query.schedules.findMany({
    where: and(
      eq(schedules.classSubjectId, opts.classSubjectId),
      eq(schedules.jour, opts.jour),
      opts.excludeId ? ne(schedules.id, opts.excludeId) : undefined,
    ),
  });

  for (const s of existing) {
    if (overlaps(opts.heureDebut, opts.heureFin, s.heureDebut, s.heureFin)) {
      throw new GraphQLError(
        `Conflit horaire : chevauchement avec ${s.heureDebut}–${s.heureFin} ce jour`,
        { extensions: { code: 'SCHEDULE_CONFLICT' } }
      );
    }
  }

  // Conflit de salle : deux cours différents, même établissement, même
  // salle, même jour, horaires qui se chevauchent — une salle ne peut
  // physiquement pas accueillir deux classes en même temps.
  if (opts.salle && opts.salle.trim() && opts.schoolId) {
    const schoolClasses = await db.query.classes.findMany({
      where: eq(classes.schoolId, opts.schoolId),
      columns: { id: true },
    });
    const schoolClassSubs = await db.query.classSubjects.findMany({
      where: inArray(classSubjects.classId, schoolClasses.map((c: { id: string }) => c.id)),
      columns: { id: true },
    });
    const csIdsInSchool = schoolClassSubs
      .map((c: { id: string }) => c.id)
      .filter((id: string) => id !== opts.classSubjectId);

    if (csIdsInSchool.length > 0) {
      const roomSlots = await db.query.schedules.findMany({
        where: and(
          inArray(schedules.classSubjectId, csIdsInSchool),
          eq(schedules.jour, opts.jour),
          eq(schedules.salle, opts.salle.trim()),
          opts.excludeId ? ne(schedules.id, opts.excludeId) : undefined,
        ),
        with: { classSubject: { with: { class: true } } },
      });
      for (const s of roomSlots) {
        if (overlaps(opts.heureDebut, opts.heureFin, s.heureDebut, s.heureFin)) {
          const occupant = (s as any).classSubject?.class?.nom ?? 'une autre classe';
          throw new GraphQLError(
            `Conflit de salle : "${opts.salle}" déjà occupée par ${occupant} de ${s.heureDebut} à ${s.heureFin} ce jour`,
            { extensions: { code: 'ROOM_CONFLICT' } }
          );
        }
      }
    }
  }

  // Vérifier aussi les créneaux de l'enseignant dans d'autres classes
  if (opts.teacherMembershipId) {
    const teacherCS = await db.query.classSubjects.findMany({
      where: eq(classSubjects.teacherMembershipId, opts.teacherMembershipId),
      columns: { id: true },
    });
    const csIds = teacherCS.map((c: { id: string }) => c.id).filter((id: string) => id !== opts.classSubjectId);

    if (csIds.length > 0) {
      const teacherSlots = await db.query.schedules.findMany({
        where: and(
          inArray(schedules.classSubjectId, csIds),
          eq(schedules.jour, opts.jour),
        ),
      });
      for (const s of teacherSlots) {
        if (overlaps(opts.heureDebut, opts.heureFin, s.heureDebut, s.heureFin)) {
          throw new GraphQLError(
            `Conflit enseignant : déjà occupé(e) de ${s.heureDebut} à ${s.heureFin} ce jour`,
            { extensions: { code: 'TEACHER_CONFLICT' } }
          );
        }
      }
    }
  }
}


