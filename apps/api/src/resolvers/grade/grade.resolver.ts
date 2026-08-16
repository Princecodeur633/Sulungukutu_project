import { eq, and, inArray, isNull, count } from 'drizzle-orm';
import { grades, students, classSubjects, classes } from '../../db/schema';
import { requireAdminOrTeacher, requireSchoolMember } from '../../middleware/permissions';
import { CreateGradeSchema, BulkCreateGradesSchema } from '../../utils/validators/schemas';
import { auditService } from '../../services/audit.service';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../middleware/auth';

export const gradeResolvers = {
  Query: {
    gradesByStudent: async (
      _: unknown,
      args: {
        filter: { studentId?: string; classSubjectId?: string; trimestre?: string; typeEval?: string };
        pagination?: { page: number; limit: number };
      },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule ; sans
      // filtre, la requête renvoyait les notes de TOUS les élèves de TOUTES
      // les écoles. Corrigé : filtre obligatoire + scoping réel.
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
      const limit  = args.pagination?.limit ?? 50;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (args.filter.studentId)      conditions.push(eq(grades.studentId,      args.filter.studentId));
      if (args.filter.classSubjectId) conditions.push(eq(grades.classSubjectId, args.filter.classSubjectId));
      if (args.filter.trimestre)      conditions.push(eq(grades.trimestre,      args.filter.trimestre as 'T1' | 'T2' | 'T3'));
      if (args.filter.typeEval)       conditions.push(eq(grades.typeEval,       args.filter.typeEval as 'DEVOIR' | 'CONTROLE' | 'EXAMEN' | 'INTERRO'));
      conditions.push(isNull(grades.deletedAt)); // exclut les notes soft-deleted

      const where = and(...conditions);

      const [data, total] = await Promise.all([
        ctx.db.query.grades.findMany({
          where,
          limit,
          offset,
          orderBy: (g, { desc }) => [desc(g.dateSaisie)],
          with: {
            student:      { with: { membership: { with: { profile: true } } } },
            classSubject: { with: { subject: true } },
            enseignant:   { with: { profile: true } },
          },
        }),
        ctx.db.select({ count: count() }).from(grades).where(where),
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

    gradesByClassSubject: async (
      _: unknown,
      args: { classSubjectId: string; trimestre?: string },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      const cs = await ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, args.classSubjectId),
        with: { class: true },
      });
      if (!cs) throw new GraphQLError('Association introuvable', { extensions: { code: 'NOT_FOUND' } });
      requireSchoolMember(ctx, (cs as any).class.schoolId);

      const conditions = [eq(grades.classSubjectId, args.classSubjectId), isNull(grades.deletedAt)];
      if (args.trimestre) conditions.push(eq(grades.trimestre, args.trimestre as 'T1' | 'T2' | 'T3'));

      return ctx.db.query.grades.findMany({
        where: and(...conditions),
        orderBy: (g, { asc }) => [asc(g.dateSaisie)],
        with: {
          student: { with: { membership: { with: { profile: true } } } },
        },
      });
    },

    gradeById: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const grade = await ctx.db.query.grades.findFirst({
        where: eq(grades.id, args.id),
        with: { classSubject: { with: { class: true, subject: true } } },
      });
      if (!grade) throw new GraphQLError('Note introuvable', { extensions: { code: 'NOT_FOUND' } });
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      requireSchoolMember(ctx, (grade.classSubject as any).class.schoolId);
      return ctx.db.query.grades.findFirst({
        where: eq(grades.id, args.id),
        with: { student: true, classSubject: { with: { subject: true } } },
      });
    },

    // Toutes les notes d'une classe pour un trimestre — vue tableur
    gradesByClass: async (
      _: unknown,
      args: { classId: string; trimestre: string },
      ctx: GraphQLContext
    ) => {
      // Avant : requireSchoolMember(ctx, '') = authentification seule.
      const targetClass = await ctx.db.query.classes.findFirst({ where: eq(classes.id, args.classId) });
      if (!targetClass) throw new GraphQLError('Classe introuvable', { extensions: { code: 'NOT_FOUND' } });
      requireSchoolMember(ctx, targetClass.schoolId);

      // 1. Élèves de la classe
      const classStudents = await ctx.db.query.students.findMany({
        where: eq(students.classId, args.classId),
        columns: { id: true },
      });
      if (classStudents.length === 0) return [];

      const studentIds = classStudents.map((s) => s.id);

      // 2. Toutes les notes du trimestre pour ces élèves
      return ctx.db.query.grades.findMany({
        where: and(
          inArray(grades.studentId, studentIds),
          isNull(grades.deletedAt),
          eq(grades.trimestre, args.trimestre as 'T1' | 'T2' | 'T3'),
        ),
        orderBy: (g, { asc }) => [asc(g.dateSaisie)],
        with: {
          student:      { with: { membership: { with: { profile: true } } } },
          classSubject: { with: { subject: true } },
        },
      });
    },
  },

  Mutation: {
    createGrade: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const user  = requireAdminOrTeacher(ctx);
      const input = CreateGradeSchema.parse(args.input);

      // Dérive l'école depuis la matière/classe ciblée et vérifie que l'acteur
      // y a bien accès (ou est SUPER_ADMIN) — au lieu de forcer `user.schoolId!`.
      const targetClassSubject = await ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, input.classSubjectId),
        with: { class: true },
      });
      if (!targetClassSubject) {
        throw new GraphQLError('Classe/matière introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const targetSchoolId = (targetClassSubject as any).class.schoolId;
      requireSchoolMember(ctx, targetSchoolId);

      const studentRow = await ctx.db.query.students.findFirst({ where: eq(students.id, input.studentId) });
      if (!studentRow || studentRow.deletedAt) {
        throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      if (studentRow.classId !== targetClassSubject.classId) {
        throw new GraphQLError("Cet élève n'appartient pas à la classe de cette matière.", {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const [created] = await ctx.db
        .insert(grades)
        .values({
          studentId:      input.studentId,
          classSubjectId: input.classSubjectId,
          valeur:         String(input.valeur),
          typeEval:       input.typeEval,
          trimestre:      input.trimestre,
          dateSaisie:     input.dateSaisie ? new Date(input.dateSaisie) : new Date(),
          enseignantId:   user.membershipId!,
        })
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'GRADE_CREATED',
        entityType:  'grade',
        entityId:    created.id,
        newValue:    { valeur: input.valeur, typeEval: input.typeEval, trimestre: input.trimestre },
        description: `Note saisie : ${input.valeur}/20`,
      });

      return ctx.db.query.grades.findFirst({
        where: eq(grades.id, created.id),
        with: {
          student: { with: { membership: { with: { profile: true } } } },
          classSubject: { with: { subject: true } },
        },
      });
    },

    // Saisie en masse après une évaluation
    bulkCreateGrades: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      const user  = requireAdminOrTeacher(ctx);
      const input = BulkCreateGradesSchema.parse(args.input);

      const targetClassSubject = await ctx.db.query.classSubjects.findFirst({
        where: eq(classSubjects.id, input.classSubjectId),
        with: { class: true },
      });
      if (!targetClassSubject) {
        throw new GraphQLError('Classe/matière introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const targetSchoolId = (targetClassSubject as any).class.schoolId;
      requireSchoolMember(ctx, targetSchoolId);

      const studentIds = new Set(input.grades.map((g) => g.studentId));
      const classStudents = await ctx.db.query.students.findMany({
        where: inArray(students.id, [...studentIds]),
      });
      if (classStudents.some((s) => s.classId !== targetClassSubject.classId || s.deletedAt)) {
        throw new GraphQLError("Un ou plusieurs élèves n'appartiennent pas à cette classe.", {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const values = input.grades.map((g) => ({
        studentId:      g.studentId,
        classSubjectId: input.classSubjectId,
        valeur:         String(g.valeur),
        typeEval:       input.typeEval,
        trimestre:      input.trimestre,
        dateSaisie:     input.dateSaisie ? new Date(input.dateSaisie) : new Date(),
        enseignantId:   user.membershipId!,
      }));

      const created = await ctx.db.insert(grades).values(values).returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'GRADE_CREATED',
        entityType:  'grade',
        entityId:    input.classSubjectId,
        description: `${created.length} notes saisies en masse (${input.typeEval} — ${input.trimestre})`,
      });

      return ctx.db.query.grades.findMany({
        where: and(
          eq(grades.classSubjectId, input.classSubjectId),
          eq(grades.trimestre, input.trimestre),
          eq(grades.typeEval, input.typeEval),
        ),
        with: {
          student: { with: { membership: { with: { profile: true } } } },
        },
      });
    },

    updateGrade: async (
      _: unknown,
      args: { id: string; input: { valeur?: number; typeEval?: string } },
      ctx: GraphQLContext
    ) => {
      const user = requireAdminOrTeacher(ctx);
      const old  = await ctx.db.query.grades.findFirst({
        where: eq(grades.id, args.id),
        with: { classSubject: { with: { class: true } } },
      });
      if (!old) {
        throw new GraphQLError('Note introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const targetSchoolId = (old as any).classSubject.class.schoolId;
      requireSchoolMember(ctx, targetSchoolId);

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (args.input.valeur   !== undefined) updateData.valeur   = String(args.input.valeur);
      if (args.input.typeEval !== undefined) updateData.typeEval = args.input.typeEval;

      const [updated] = await ctx.db
        .update(grades).set(updateData).where(eq(grades.id, args.id)).returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'GRADE_UPDATED',
        entityType:  'grade',
        entityId:    args.id,
        oldValue:    old ? { valeur: old.valeur } : undefined,
        newValue:    { valeur: args.input.valeur },
        description: `Note modifiée : ${old?.valeur} → ${args.input.valeur}`,
      });

      return updated;
    },

    deleteGrade: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireAdminOrTeacher(ctx);
      const existing = await ctx.db.query.grades.findFirst({
        where: eq(grades.id, args.id),
        with: { classSubject: { with: { class: true } } },
      });
      if (!existing) {
        throw new GraphQLError('Note introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      const targetSchoolId = (existing as any).classSubject.class.schoolId;
      requireSchoolMember(ctx, targetSchoolId);

      // Avant : DELETE physique. Corrigé : soft delete, restaurable.
      await ctx.db
        .update(grades)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(grades.id, args.id));
      await auditService.log(ctx.db, {
        schoolId:   targetSchoolId,
        actorId:    user.membershipId,
        action:     'GRADE_DELETED',
        entityType: 'grade',
        entityId:   args.id,
      });
      return true;
    },

    restoreGrade: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireAdminOrTeacher(ctx);
      const existing = await ctx.db.query.grades.findFirst({
        where: eq(grades.id, args.id),
        with: { classSubject: { with: { class: true } } },
      });
      if (!existing) throw new GraphQLError('Note introuvable', { extensions: { code: 'NOT_FOUND' } });
      const targetSchoolId = (existing as any).classSubject.class.schoolId;
      requireSchoolMember(ctx, targetSchoolId);

      const [updated] = await ctx.db
        .update(grades)
        .set({ isActive: true, deletedAt: null })
        .where(eq(grades.id, args.id))
        .returning();
      await auditService.log(ctx.db, {
        schoolId:   targetSchoolId,
        actorId:    user.membershipId,
        action:     'GRADE_UPDATED',
        entityType: 'grade',
        entityId:   args.id,
        description: 'Note restaurée',
      });
      return updated;
    },
  },
};
