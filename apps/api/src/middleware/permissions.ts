import { GraphQLContext } from './auth';
import { GraphQLError } from 'graphql';
import { eq, and } from 'drizzle-orm';
import { students, parentStudents, schoolMemberships } from '../db/schema';

type AllowedRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

export function requireAuth(ctx: GraphQLContext): NonNullable<GraphQLContext['currentUser']> {
  if (!ctx.currentUser) {
    throw new GraphQLError('Non authentifié. Veuillez vous connecter.', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.currentUser;
}

export function requireRole(ctx: GraphQLContext, ...roles: AllowedRole[]): NonNullable<GraphQLContext['currentUser']> {
  const user = requireAuth(ctx);
  if (!roles.includes(user.role as AllowedRole)) {
    throw new GraphQLError(
      `Accès refusé. Rôle requis : ${roles.join(' ou ')}. Votre rôle : ${user.role}`,
      { extensions: { code: 'FORBIDDEN' } }
    );
  }
  return user;
}

export function requireSuperAdmin(ctx: GraphQLContext) {
  return requireRole(ctx, 'SUPER_ADMIN');
}

export function requireAdmin(ctx: GraphQLContext) {
  return requireRole(ctx, 'ADMIN', 'SUPER_ADMIN');
}

export function requireAdminOrTeacher(ctx: GraphQLContext) {
  return requireRole(ctx, 'ADMIN', 'TEACHER', 'SUPER_ADMIN');
}

/**
 * Vérifie que l'utilisateur est membre de l'école.
 * Si schoolId est '' ou undefined → vérifie seulement l'authentification (pas l'école).
 * Si schoolId est fourni → vérifie que l'utilisateur appartient à cette école.
 */
export function requireSchoolMember(ctx: GraphQLContext, schoolId: string) {
  const user = requireAuth(ctx);
  // SUPER_ADMIN a accès à tout
  if (user.role === 'SUPER_ADMIN') return user;
  // Si aucun schoolId fourni → juste vérifier l'auth
  if (!schoolId) return user;
  // Vérifier l'appartenance à l'école
  if (user.schoolId !== schoolId) {
    throw new GraphQLError('Accès refusé à cet établissement.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}

/** Membership actif du rôle demandé pour ce profil dans cette école (indépendant du JWT). */
export async function findActiveMembershipByRole(
  ctx: GraphQLContext,
  schoolId: string,
  role: 'PARENT' | 'STUDENT' | 'TEACHER' | 'ADMIN'
) {
  const user = requireAuth(ctx);
  return ctx.db.query.schoolMemberships.findFirst({
    where: and(
      eq(schoolMemberships.profileId, user.profileId),
      eq(schoolMemberships.schoolId, schoolId),
      eq(schoolMemberships.role, role),
      eq(schoolMemberships.status, 'ACTIVE'),
    ),
  });
}

export function requireSchoolAdmin(ctx: GraphQLContext, schoolId: string) {
  const user = requireSchoolMember(ctx, schoolId);
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw new GraphQLError('Seul un administrateur peut effectuer cette action.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}

/**
 * Vérifie qu'un utilisateur peut accéder aux données d'un élève précis
 * (ex: ses paiements) : membre du staff de l'école (admin/enseignant/super
 * admin), l'élève lui-même, ou un parent effectivement rattaché à cet élève.
 *
 * Corrige un vrai trou de sécurité : certaines requêtes appelaient
 * auparavant `requireSchoolMember(ctx, '')`, qui ne vérifie QUE
 * l'authentification — n'importe quel utilisateur connecté (même d'une
 * autre école) pouvait alors consulter les paiements de n'importe quel
 * élève simplement en connaissant son studentId.
 */
export async function requireStudentAccess(
  ctx: GraphQLContext,
  studentId: string,
  schoolId: string
) {
  const user = requireSchoolMember(ctx, schoolId);

  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'TEACHER') {
    return user;
  }

  if (user.role === 'STUDENT') {
    const student = await ctx.db.query.students.findFirst({ where: eq(students.id, studentId) });
    if (student && student.membershipId === user.membershipId) return user;
    const studentMembership = await findActiveMembershipByRole(ctx, schoolId, 'STUDENT');
    if (student && studentMembership && student.membershipId === studentMembership.id) return user;
    throw new GraphQLError('Accès refusé : vous ne pouvez consulter que vos propres informations.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  if (user.role === 'PARENT') {
    // Le JWT peut porter un autre membership (ex. enseignant) du même profil.
    // Les rattachements parent↔élève sont sur le membership PARENT de l'école.
    const parentMembership = await findActiveMembershipByRole(ctx, schoolId, 'PARENT');
    const parentMembershipId = parentMembership?.id ?? user.membershipId;
    const link = parentMembershipId
      ? await ctx.db.query.parentStudents.findFirst({
          where: and(
            eq(parentStudents.parentMembershipId, parentMembershipId),
            eq(parentStudents.studentId, studentId)
          ),
        })
      : undefined;
    if (link) return user;
    throw new GraphQLError("Accès refusé : cet élève n'est pas rattaché à votre compte parent.", {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  throw new GraphQLError('Accès refusé — permissions insuffisantes.', {
    extensions: { code: 'FORBIDDEN' },
  });
}
