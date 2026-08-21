import type { IncomingMessage, ServerResponse } from 'http';
import { parse as parseUrl } from 'url';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { students, parentStudents, classes, schoolMemberships } from '../db/schema';
import { extractBearerToken, type JWTPayload } from '../utils/jwt';
import { resolveCurrentUser } from './auth';

export class HttpAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpAuthError';
  }
}

export async function authenticateHttpRequest(req: IncomingMessage): Promise<JWTPayload> {
  const url = parseUrl(req.url ?? '', true);
  const headerToken = extractBearerToken(req.headers.authorization);
  const queryToken = typeof url.query.token === 'string' ? url.query.token : undefined;
  const user = await resolveCurrentUser(headerToken ?? queryToken);
  if (!user) {
    throw new HttpAuthError(401, 'Token invalide, expiré ou compte inactif');
  }
  return user;
}

export function requireHttpRole(user: JWTPayload, ...roles: string[]): void {
  if (user.role === 'SUPER_ADMIN') return;
  if (!roles.includes(user.role)) {
    throw new HttpAuthError(403, `Accès refusé. Rôle requis : ${roles.join(' ou ')}.`);
  }
}

export function requireHttpSchoolMember(user: JWTPayload, schoolId: string): void {
  if (user.role === 'SUPER_ADMIN') return;
  if (!schoolId || user.schoolId !== schoolId) {
    throw new HttpAuthError(403, 'Accès refusé à cet établissement.');
  }
}

export async function requireHttpStudentAccess(
  user: JWTPayload,
  studentId: string,
  schoolId: string
): Promise<void> {
  requireHttpSchoolMember(user, schoolId);

  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'TEACHER') {
    return;
  }

  if (user.role === 'STUDENT') {
    const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
    if (student && student.membershipId === user.membershipId) return;
    const studentMembership = await db.query.schoolMemberships.findFirst({
      where: and(
        eq(schoolMemberships.profileId, user.profileId),
        eq(schoolMemberships.schoolId, schoolId),
        eq(schoolMemberships.role, 'STUDENT'),
        eq(schoolMemberships.status, 'ACTIVE'),
      ),
    });
    if (student && studentMembership && student.membershipId === studentMembership.id) return;
    throw new HttpAuthError(403, 'Vous ne pouvez consulter que vos propres informations.');
  }

  if (user.role === 'PARENT') {
    const parentMembership = await db.query.schoolMemberships.findFirst({
      where: and(
        eq(schoolMemberships.profileId, user.profileId),
        eq(schoolMemberships.schoolId, schoolId),
        eq(schoolMemberships.role, 'PARENT'),
        eq(schoolMemberships.status, 'ACTIVE'),
      ),
    });
    const parentMembershipId = parentMembership?.id ?? user.membershipId;
    const link = parentMembershipId
      ? await db.query.parentStudents.findFirst({
          where: and(
            eq(parentStudents.parentMembershipId, parentMembershipId),
            eq(parentStudents.studentId, studentId)
          ),
        })
      : undefined;
    if (link) return;
    throw new HttpAuthError(403, "Cet élève n'est pas rattaché à votre compte parent.");
  }

  throw new HttpAuthError(403, 'Permissions insuffisantes.');
}

export async function requireHttpClassInSchool(
  user: JWTPayload,
  classId: string,
  staffOnly = false
): Promise<typeof classes.$inferSelect> {
  const targetClass = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
  if (!targetClass) throw new HttpAuthError(404, 'Classe introuvable');
  requireHttpSchoolMember(user, targetClass.schoolId);
  if (staffOnly) {
    requireHttpRole(user, 'ADMIN', 'TEACHER', 'SUPER_ADMIN');
  }
  return targetClass;
}

export function sendHttpAuthError(res: ServerResponse, err: unknown, extraHeaders: Record<string, string> = {}): boolean {
  if (err instanceof HttpAuthError) {
    res.writeHead(err.status, { 'Content-Type': 'application/json', ...extraHeaders });
    res.end(JSON.stringify({ error: err.message }));
    return true;
  }
  return false;
}
