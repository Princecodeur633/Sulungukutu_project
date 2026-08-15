/**
 * Domain types partagés — élimine les 'any' récurrents dans les resolvers.
 * Ces types reflètent les sorties de Drizzle ORM avec leurs relations chargées.
 */

// ── Profil & Membership ───────────────────────────────────────
export interface ProfileData {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipData {
  id: string;
  profileId: string;
  schoolId: string;
  role: string;
  code: string;
  status: string;
  joinedAt: Date;
  profile?: ProfileData;
}

// ── Classe & Matière ──────────────────────────────────────────
export interface LevelData {
  id: string;
  nom: string;
  type: string;
  ordre: number;
  schoolId: string;
}

export interface ClassData {
  id: string;
  nom: string;
  schoolId: string;
  levelId: string;
  level?: LevelData;
}

export interface SubjectData {
  id: string;
  nom: string;
  description?: string | null;
  schoolId: string;
}

export interface ClassSubjectData {
  id: string;
  classId: string;
  subjectId: string;
  teacherMembershipId: string;
  coefficient: string | number;
  hoursPerWeek?: number | null;
  isActive?: boolean;
  deletedAt?: Date | null;
  class?: ClassData;
  subject?: SubjectData;
  teacher?: MembershipData;
  schedules?: ScheduleData[];
  grades?: GradeData[];
  attendances?: AttendanceData[];
}

// ── EDT ───────────────────────────────────────────────────────
export interface ScheduleData {
  id: string;
  classSubjectId: string;
  jour: number;
  heureDebut: string;
  heureFin: string;
  salle?: string | null;
  createdAt: Date;
  classSubject?: ClassSubjectData;
}

// ── Notes ─────────────────────────────────────────────────────
export interface GradeData {
  id: string;
  studentId: string;
  classSubjectId: string;
  valeur: string | number;
  typeEval: string;
  trimestre: string;
  dateSaisie: Date;
  enseignantId: string;
  classSubject?: ClassSubjectData;
}

// ── Présences ─────────────────────────────────────────────────
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'RETARD' | 'EXCUSED';

export interface AttendanceData {
  id: string;
  studentId: string;
  classSubjectId: string;
  date: string;
  statut: AttendanceStatus;
  motif?: string | null;
  markedById: string;
  classSubject?: ClassSubjectData;
}

// ── Étudiant ──────────────────────────────────────────────────
export interface StudentData {
  id: string;
  membershipId: string;
  classId: string;
  matricule: string;
  dateNaissance?: string | null;
  sexe?: string | null;
  isActive?: boolean;
  deletedAt?: Date | null;
  membership?: MembershipData;
  class?: ClassData;
  grades?: GradeData[];
  attendances?: AttendanceData[];
  parents?: ParentStudentData[];
  payments?: PaymentData[];
  bulletins?: BulletinData[];
}

export interface ParentStudentData {
  parentMembershipId: string;
  studentId: string;
  lien?: string | null;
  parent?: MembershipData;
  student?: StudentData;
}

// ── Paiements ─────────────────────────────────────────────────
export type PaymentStatus = 'PAYE' | 'IMPAYE' | 'EN_ATTENTE' | 'EXONERE';

export interface PaymentData {
  id: string;
  studentId: string;
  mois: number;
  anneeScolaire: string;
  statut: PaymentStatus;
  datePaiement?: Date | null;
  updatedById?: string | null;
  createdAt: Date;
  updatedAt: Date;
  student?: StudentData;
}

// ── Bulletins ─────────────────────────────────────────────────
export type BulletinStatus = 'BROUILLON' | 'PUBLIE';
export type Trimestre = 'T1' | 'T2' | 'T3';

export interface BulletinDetailData {
  id: string;
  bulletinId: string;
  classSubjectId: string;
  moyenneMatiere: string | number;
  coefficient: string | number;
  appreciation?: string | null;
  classSubject?: ClassSubjectData;
}

export interface BulletinData {
  id: string;
  studentId: string;
  trimestre: Trimestre;
  anneeScolaire: string;
  statut: BulletinStatus;
  moyenneGenerale?: string | number | null;
  rang?: number | null;
  mention?: string | null;
  generatedAt?: Date | null;
  pdfUrl?: string | null;
  student?: StudentData;
  details?: BulletinDetailData[];
}

// ── École ─────────────────────────────────────────────────────
export interface SchoolData {
  id: string;
  code: string;
  nom: string;
  logoUrl?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  anneeScolaire: string;
  isActive: boolean;
  accentColor?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Messages & Notifications ──────────────────────────────────
export interface MessageData {
  id: string;
  schoolId: string;
  senderId: string;
  receiverId: string;
  sujet: string;
  contenu: string;
  lu: boolean;
  createdAt: Date;
}

export interface NotificationData {
  id: string;
  profileId: string;
  type: string;
  titre: string;
  message: string;
  lu: boolean;
  createdAt: Date;
}

// ── Helpers ───────────────────────────────────────────────────
export type Maybe<T> = T | null | undefined;
export type ID = string;

/** Calcule la moyenne pondérée à partir d'un tableau de notes */
export function weightedAverage(grades: Array<{ valeur: string | number; coefficient: string | number }>): number | null {
  const valid = grades.filter(g => g.valeur !== null && g.valeur !== undefined && !isNaN(Number(g.valeur)));
  if (valid.length === 0) return null;
  const totalCoeff = valid.reduce((s, g) => s + Number(g.coefficient), 0);
  if (totalCoeff === 0) return null;
  const totalWeighted = valid.reduce((s, g) => s + Number(g.valeur) * Number(g.coefficient), 0);
  return Math.round((totalWeighted / totalCoeff) * 100) / 100;
}

/** Retourne le label de mention à partir d'une moyenne */
export function getMention(moyenne: number): string {
  if (moyenne >= 16) return 'EXCELLENT';
  if (moyenne >= 14) return 'TRES_BIEN';
  if (moyenne >= 12) return 'BIEN';
  if (moyenne >= 10) return 'ASSEZ_BIEN';
  if (moyenne >= 8)  return 'PASSABLE';
  return 'INSUFFISANT';
}
