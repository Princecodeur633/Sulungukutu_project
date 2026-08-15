import { eq, and, count, sql, gte, lte, inArray } from 'drizzle-orm';
import {
  students, schoolMemberships, classes, attendances,
  payments, parentStudents, classSubjects, schedules, grades, bulletins,
  auditLogs, messages, notifications, announcements, schools,
} from '../../db/schema';
import { requireSchoolMember, requireStudentAccess } from '../../middleware/permissions';
import { paymentService } from '../../services/payment.service';
import type { GraphQLContext } from '../../middleware/auth';
import type {
  StudentData, ClassSubjectData, ScheduleData, GradeData,
  AttendanceData, ParentStudentData, PaymentData,
} from '../../types/domain';

export const dashboardResolvers = {
  Query: {
    // ── Admin Dashboard ────────────────────────────────────────
    adminDashboard: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      requireSchoolMember(ctx, args.schoolId);

      const today = new Date().toISOString().split('T')[0];

      // Counts en parallèle
      const [
        [studentsCount],
        [teachersCount],
        [parentsCount],
        [classesCount],
        presentCount,
        absentCount,
      ] = await Promise.all([
        ctx.db.select({ count: count() }).from(schoolMemberships).where(
          and(eq(schoolMemberships.schoolId, args.schoolId), eq(schoolMemberships.role, 'STUDENT'))
        ),
        ctx.db.select({ count: count() }).from(schoolMemberships).where(
          and(eq(schoolMemberships.schoolId, args.schoolId), eq(schoolMemberships.role, 'TEACHER'))
        ),
        ctx.db.select({ count: count() }).from(schoolMemberships).where(
          and(eq(schoolMemberships.schoolId, args.schoolId), eq(schoolMemberships.role, 'PARENT'))
        ),
        ctx.db.select({ count: count() }).from(classes).where(
          eq(classes.schoolId, args.schoolId)
        ),
        ctx.db.select({ count: count() }).from(attendances).where(
          and(eq(attendances.date, today), eq(attendances.statut, 'PRESENT'))
        ),
        ctx.db.select({ count: count() }).from(attendances).where(
          and(eq(attendances.date, today), eq(attendances.statut, 'ABSENT'))
        ),
      ]);

      // Élèves impayés ce mois
      const currentMonth = new Date().getMonth() + 1;
      const [unpaidCount] = await ctx.db
        .select({ count: count() })
        .from(payments)
        .where(and(
          eq(payments.mois,   currentMonth),
          eq(payments.statut, 'IMPAYE'),
        ));

      // Performances par classe
      const allClasses = await ctx.db.query.classes.findMany({
        where: eq(classes.schoolId, args.schoolId),
        columns: { id: true, nom: true },
      });

      const classPerformance = await Promise.all(
        allClasses.map(async (cls) => {
          const classGrades = await ctx.db.query.grades.findMany({
            where: sql`${grades.classSubjectId} IN (
              SELECT id FROM class_subjects WHERE class_id = ${cls.id}
            )`,
            columns: { valeur: true },
          });
          const total = classGrades.length;
          const sum   = classGrades.reduce((a, g) => a + Number(g.valeur), 0);
          return {
            class:           cls,
            moyenneGenerale: total > 0 ? (sum / total).toFixed(2) : '0',
          };
        })
      );

      // Dernières actions audit
      const recentAuditLogs = await ctx.db.query.auditLogs.findMany({
        where:   eq(auditLogs.schoolId, args.schoolId),
        limit:   8,
        orderBy: (a, { desc }) => [desc(a.createdAt)],
        with:    { actor: { with: { profile: true } } },
      });


      // Evolution moyennes par trimestre (bulletins publies)
      const buls = await ctx.db.query.bulletins.findMany({
        where: and(
          eq(bulletins.statut, 'PUBLIE'),
          sql`${bulletins.studentId} IN (
            SELECT s.id FROM students s
            JOIN school_memberships m ON s.membership_id = m.id
            WHERE m.school_id = ${args.schoolId}
          )`,
        ),
        columns: { trimestre: true, moyenneGenerale: true, mention: true },
      });
      const tmap: Record<string, number[]> = { T1: [], T2: [], T3: [] };
      for (const b of buls) {
        if (b.moyenneGenerale && tmap[b.trimestre]) tmap[b.trimestre].push(Number(b.moyenneGenerale));
      }
      const gradeEvolution = (['T1','T2','T3'] as const)
        .map(t => ({ trimestre: t==='T1'?'1er Trim.':t==='T2'?'2eme Trim.':'3eme Trim.', moyenne: tmap[t].length>0?parseFloat((tmap[t].reduce((a,v)=>a+v,0)/tmap[t].length).toFixed(2)):0, nbEleves: tmap[t].length }))
        .filter(p => p.nbEleves > 0);
      const mcount: Record<string,number> = {};
      for (const b of buls) { if (b.mention) mcount[b.mention] = (mcount[b.mention]??0)+1; }
      const mcolors: Record<string,string> = { EXCELLENT:'#16a34a',TRES_BIEN:'#2563eb',BIEN:'#0891b2',ASSEZ_BIEN:'#d97706',PASSABLE:'#ea580c',INSUFFISANT:'#dc2626' };
      const mlabels: Record<string,string> = { EXCELLENT:'Excellent',TRES_BIEN:'Tres Bien',BIEN:'Bien',ASSEZ_BIEN:'Assez Bien',PASSABLE:'Passable',INSUFFISANT:'Insuffisant' };
      const mentionDistribution = Object.entries(mcount).map(([m,cnt])=>({ mention: mlabels[m]??m, count: cnt, color: mcolors[m]??'#6b7280' })).sort((a,b)=>b.count-a.count);

      return {
        totalStudents:       Number(studentsCount.count),
        totalTeachers:       Number(teachersCount.count),
        totalParents:        Number(parentsCount.count),
        totalClasses:        Number(classesCount.count),
        presentToday:        Number(presentCount[0]?.count ?? 0),
        absentToday:         Number(absentCount[0]?.count ?? 0),
        unpaidCurrentMonth:  Number(unpaidCount.count),
        unpaidStudents:      [],
        classPerformance,
        recentAuditLogs,
        attendanceHeatmap:   [],
        gradeEvolution,
        mentionDistribution,
      };
    },

    // ── Teacher Dashboard ──────────────────────────────────────
    teacherDashboard: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      const user = requireSchoolMember(ctx, args.schoolId);
      const today = new Date().getDay(); // 0=Dim, 1=Lun...

      const myClassSubjects = await ctx.db.query.classSubjects.findMany({
        where: eq(classSubjects.teacherMembershipId, user.membershipId!),
        with: {
          class:    { with: { level: true } },
          subject:  true,
          schedules: true,
        },
      });

      // Cours d'aujourd'hui
      const todayCS = myClassSubjects.filter((cs: ClassSubjectData) =>
        (cs.schedules ?? []).some((s: ScheduleData) => s.jour === today)
      );

      // Mes classes uniques
      const uniqueClasses = new Map<string, ClassSubjectData['class']>();
      for (const cs of myClassSubjects as ClassSubjectData[]) {
        if (!cs.class) continue;
        if (!uniqueClasses.has(cs.class.id)) uniqueClasses.set(cs.class.id, cs.class);
      }

      // Dernières notes saisies
      const recentGrades = await ctx.db.query.grades.findMany({
        where:   eq(grades.enseignantId, user.membershipId!),
        limit:   10,
        orderBy: (g, { desc }) => [desc(g.dateSaisie)],
        with:    { student: { with: { membership: { with: { profile: true } } } }, classSubject: { with: { subject: true, class: true } } },
      });

      // ── Élèves de mes classes (pour absences semaine + élèves à risque)
      const myClassIds = Array.from(uniqueClasses.keys());

      // Absences de la semaine (lun–ven)
      const JOUR_LABELS = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      let weeklyAbsences: Array<{ jour: string; absences: number; presents: number; total: number }> = [];
      let studentsAtRisk: Array<{ id: string; nom: string; prenom: string; absences: number; moyenne: number | null }> = [];
      let totalStudents = 0;

      if (myClassIds.length > 0) {
        // Dernier lundi
        const now = new Date();
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Lun, 7=Dim
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek - 1));
        monday.setHours(0, 0, 0, 0);

        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        friday.setHours(23, 59, 59, 999);

        // Tous les étudiants de mes classes
        const myStudents = await ctx.db.query.students.findMany({
          where: (s, { inArray }) => inArray(s.classId, myClassIds),
          with: {
            grades:      true,
            attendances: {
              where: (a, { and, gte, lte }) =>
                and(gte(a.date, monday.toISOString().split('T')[0]),
                    lte(a.date, friday.toISOString().split('T')[0])),
            },
            membership: { with: { profile: true } },
          },
        });

        totalStudents = myStudents.length;

        // Statistiques par jour (1=Lun..5=Ven)
        const statsByDay: Record<number, { absences: number; presents: number; total: number }> = {};
        for (let j = 1; j <= 5; j++) statsByDay[j] = { absences: 0, presents: 0, total: 0 };

        for (const student of myStudents) {
          for (const att of (student as StudentData).attendances ?? []) {
            const d   = new Date(att.date);
            const dow = d.getDay() === 0 ? 7 : d.getDay();
            if (dow >= 1 && dow <= 5) {
              statsByDay[dow].total++;
              if (att.statut === 'ABSENT') statsByDay[dow].absences++;
              else if (att.statut === 'PRESENT') statsByDay[dow].presents++;
            }
          }
        }

        weeklyAbsences = [1, 2, 3, 4, 5].map((j) => ({
          jour: JOUR_LABELS[j],
          ...statsByDay[j],
        }));

        // Élèves à risque : moyenne < 10 ou absences >= 3 cette semaine
        for (const student of myStudents) {
          const gVals = ((student as StudentData).grades ?? []).map((g: GradeData) => Number(g.valeur));
          const moy   = gVals.length > 0
            ? gVals.reduce((a: number, b: number) => a + b, 0) / gVals.length
            : null;
          const absCount = ((student as StudentData).attendances ?? []).filter((a: AttendanceData) => a.statut === 'ABSENT'
          ).length;

          if ((moy !== null && moy < 10) || absCount >= 3) {
            const profile = (student as StudentData).membership?.profile;
            studentsAtRisk.push({
              id:       student.id,
              nom:      profile?.nom ?? '',
              prenom:   profile?.prenom ?? '',
              absences: absCount,
              moyenne:  moy,
            });
          }
        }
        // Trier par moyenne croissante (les plus en difficulté d'abord ; ceux
        // sans moyenne du tout passent en dernier plutôt que de planter le tri)
        studentsAtRisk.sort((a, b) => (a.moyenne ?? 99) - (b.moyenne ?? 99));
        studentsAtRisk = studentsAtRisk.slice(0, 8);
      }

      return {
        classSubjectsToday: todayCS,
        recentGrades: recentGrades.filter(g => g.classSubject != null),
        pendingAttendance:  todayCS,
        myClasses:          Array.from(uniqueClasses.values()),
        weeklyAbsences,
        studentsAtRisk,
        totalStudents,
      };
    },

    // ── Parent Dashboard ───────────────────────────────────────
    parentDashboard: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      const user = requireSchoolMember(ctx, args.schoolId);
      // NOTE: "2024-2025" était codé en dur ici — un établissement configuré
      // sur une autre année scolaire (voir Admin > Paramètres) obtenait alors
      // un résumé des paiements pour la mauvaise année, potentiellement vide.
      const school = await ctx.db.query.schools.findFirst({ where: eq(schools.id, args.schoolId) });
      const anneeScolaire = school?.anneeScolaire ?? '2024-2025';

      const parentLinks = await ctx.db.query.parentStudents.findMany({
        where: eq(parentStudents.parentMembershipId, user.membershipId!),
        with: {
          student: {
            with: {
              membership: { with: { profile: true } },
              class: true,
              grades: true,
              attendances: true,
            },
          },
        },
      });

      const children = (await Promise.all(
        parentLinks.map(async (link: ParentStudentData) => {
          const student = link.student;
          if (!student) return null; // lien orphelin (ne devrait pas arriver, FK garantit la présence)
          const paymentSummary = await paymentService.getPaymentSummary(
            ctx.db, student.id, anneeScolaire
          );

          // Calcul moyenne générale
          const gradeValues = (student.grades ?? []).map((g: GradeData) => Number(g.valeur));
          const moyenneGenerale = gradeValues.length > 0
            ? gradeValues.reduce((a: number, b: number) => a + b, 0) / gradeValues.length
            : null;

          // Taux présence
          const totalAttendances = (student.attendances ?? []).length;
          const presents = (student.attendances ?? []).filter((a: AttendanceData) => a.statut === 'PRESENT').length;
          const presenceRate = totalAttendances > 0 ? presents / totalAttendances : null;

          // Mois courant
          const currentMonth   = new Date().getMonth() + 1;
          const currentPayment = paymentSummary.moisDetails.find((p) => p.mois === currentMonth) ?? null;
          const unpaidMonths   = paymentSummary.moisDetails.filter((p) => p.statut === 'IMPAYE');

          // Dernières notes
          const recentGrades = (student.grades ?? [])
            .sort((a: GradeData, b: GradeData) => new Date(b.dateSaisie).getTime() - new Date(a.dateSaisie).getTime())
            .slice(0, 5);

          // Dernières absences
          const recentAbsences = (student.attendances ?? [])
            .filter((a: AttendanceData) => a.statut === "ABSENT")
            .sort((a: AttendanceData, b: AttendanceData) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);

          return {
            student,
            moyenneGenerale,
            presenceRate,
            currentMonthPayment: currentPayment,
            unpaidMonths,
            recentGrades: recentGrades.filter((g: any) => g.classSubject != null),
            recentAbsences,
          };
        })
      )).filter((c): c is NonNullable<typeof c> => c !== null);

      // Compter messages et notifications non lus
      const [unreadMessages]       = await ctx.db
        .select({ count: count() })
        .from(messages)
        .where(and(
          eq(messages.receiverId, user.membershipId!),
          eq(messages.lu, false),
        ));
      const [unreadNotifications]  = await ctx.db
        .select({ count: count() })
        .from(notifications)
        .where(and(
          eq(notifications.profileId, user.profileId),
          eq(notifications.lu, false),
        ));

      return {
        children,
        unreadMessages:      Number(unreadMessages.count),
        unreadNotifications: Number(unreadNotifications.count),
      };
    },

    // ── Student Dashboard ──────────────────────────────────────
    studentDashboard: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      const user = requireSchoolMember(ctx, args.schoolId);

      const student = await ctx.db.query.students.findFirst({
        where: eq(students.membershipId, user.membershipId!),
        with:  { class: true },
      });

      if (!student) return {
        recentGrades: [], upcomingSchedule: [],
        recentAbsences: [], currentMoyennes: [], announcements: [],
      };

      // Dernières notes
      const recentGrades = await ctx.db.query.grades.findMany({
        where:   eq(grades.studentId, student.id),
        limit:   8,
        orderBy: (g, { desc }) => [desc(g.dateSaisie)],
        with:    { classSubject: { with: { subject: true, class: true } } },
      });

      // Emploi du temps de la semaine
      const classSchedules = await ctx.db.query.schedules.findMany({
        where: sql`${schedules.classSubjectId} IN (
          SELECT id FROM class_subjects WHERE class_id = ${student.classId}
        )`,
        with:    { classSubject: { with: { subject: true, teacher: { with: { profile: true } } } } },
        orderBy: (s, { asc }) => [asc(s.jour), asc(s.heureDebut)],
      });

      // Absences récentes
      const recentAbsences = await ctx.db.query.attendances.findMany({
        where:   and(eq(attendances.studentId, student.id), eq(attendances.statut, 'ABSENT')),
        limit:   5,
        orderBy: (a, { desc }) => [desc(a.date)],
        with:    { classSubject: { with: { subject: true, class: true } } },
      });

      // Annonces de l'école — uniquement celles destinées aux élèves (ou à
      // tout le monde). Auparavant, TOUTES les annonces de l'école étaient
      // renvoyées sans tenir compte de la cible choisie par l'administrateur
      // (ex: une annonce réservée aux enseignants apparaissait aussi ici).
      const schoolAnnouncements = await ctx.db.query.announcements.findMany({
        where: and(
          eq(announcements.schoolId, args.schoolId),
          inArray(announcements.cible, ['ALL', 'STUDENTS'])
        ),
        limit: 5,
        orderBy: (a, { desc }) => [desc(a.createdAt)],
      });

      return {
        recentGrades: recentGrades.filter((g: any) => g.classSubject != null),
        upcomingSchedule: classSchedules,
        recentAbsences,
        currentMoyennes:  [],
        announcements:    schoolAnnouncements,
      };
    },

    // ── Parent — mes enfants ───────────────────────────────────
    myChildren: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      const user = requireSchoolMember(ctx, args.schoolId);
      const links = await ctx.db.query.parentStudents.findMany({
        where: eq(parentStudents.parentMembershipId, user.membershipId!),
        with:  { student: { with: { membership: { with: { profile: true } }, class: true } } },
      });
      return links.map((l: ParentStudentData) => l.student);
    },

    childSummary: async (_: unknown, args: { studentId: string }, ctx: GraphQLContext) => {
      const targetStudent = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.studentId),
        with: { class: true },
      });
      if (!targetStudent) return null;
      // Avant : requireSchoolMember(ctx, '') = authentification seule — un
      // parent pouvait consulter le résumé complet (notes, présences,
      // paiements) de N'IMPORTE QUEL autre élève de la plateforme, pas
      // seulement le sien. Corrigé.
      await requireStudentAccess(ctx, args.studentId, (targetStudent as any).class.schoolId);

      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, args.studentId),
        with: {
          membership:  { with: { profile: true } },
          class:       { with: { level: true } },
          parents:     { with: { parent: { with: { profile: true } } } },
          grades:      {
            with: { classSubject: { with: { subject: true, teacher: { with: { profile: true } } } } },
            orderBy: (g, { desc }) => [desc(g.dateSaisie)],
          },
          attendances: {
            with: { classSubject: { with: { subject: true, class: true } } },
            orderBy: (a, { desc }) => [desc(a.date)],
          },
        },
      });
      if (!student) return null;

      const allGrades     = (student as StudentData).grades ?? [];
      const allAttendances = (student as StudentData).attendances ?? [];

      const gVals = (allGrades as GradeData[]).map(g => Number(g.valeur));
      const moy   = gVals.length > 0 ? gVals.reduce((a: number, b: number) => a + b, 0) / gVals.length : null;
      const total = allAttendances.length;
      const pres  = (allAttendances as AttendanceData[]).filter(a => a.statut === "PRESENT").length;

      const schoolIdForStudent = (student as any).membership?.schoolId;
      const studentSchool = schoolIdForStudent
        ? await ctx.db.query.schools.findFirst({ where: eq(schools.id, schoolIdForStudent) })
        : null;
      const paymentSummary = await paymentService.getPaymentSummary(ctx.db, student.id, studentSchool?.anneeScolaire ?? '2024-2025');
      const currentMonth = new Date().getMonth() + 1;

      return {
        student,
        moyenneGenerale:     moy,
        presenceRate:        total > 0 ? pres / total : null,
        currentMonthPayment: paymentSummary.moisDetails.find((p) => p.mois === currentMonth) ?? null,
        unpaidMonths:        paymentSummary.moisDetails.filter((p) => p.statut === 'IMPAYE'),
        recentGrades:        allGrades.filter((g: any) => g.classSubject != null).slice(0, 5),
        recentAbsences:      (allAttendances as AttendanceData[]).filter(a => a.statut === "ABSENT").slice(0, 5),
        allGrades,
        allAttendances,
      };
    },

    // NOTE: `searchMembers` est implémenté dans user.resolver.ts, qui est
    // fusionné après ce fichier dans index.ts et écrase donc cette définition.
    // Une seconde implémentation existait ici par erreur (jamais exécutée) et
    // a été supprimée pour éviter toute confusion.
  },
};
