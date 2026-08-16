import { z } from 'zod';

// ── Auth ──────────────────────────────────────────────────────
export const LoginSchema = z.object({
  // Peut être un email, un identifiant de connexion (matricule, ex: STU-A1B2)
  // ou un numéro de téléphone — voir auth.resolver.ts pour la résolution.
  identifiant: z.string().min(3, 'Identifiant requis'),
  password:    z.string().min(6, 'Mot de passe minimum 6 caractères'),
});

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(8, 'Nouveau mot de passe minimum 8 caractères')
    .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Doit contenir au moins un chiffre'),
});

// ── Établissement ─────────────────────────────────────────────
export const CreateSchoolSchema = z.object({
  nom:           z.string().min(2).max(200),
  adresse:       z.string().max(500).optional(),
  telephone:     z.string().max(20).optional(),
  anneeScolaire: z.string().regex(/^\d{4}-\d{4}$/, 'Format: 2024-2025'),
  logoUrl:       z.string().url().optional(),
  adminNom:      z.string().min(2).max(100),
  adminPrenom:   z.string().min(2).max(100),
  // Avant : email obligatoire, seul moyen d'identifier l'admin. Beaucoup
  // d'administrateurs n'ont qu'un téléphone — l'un des deux suffit
  // désormais (vérifié dans le resolver, comme pour createStudent/inviteUser).
  adminEmail:    z.string().email().optional(),
  adminPhone:    z.string().max(20).optional(),
  // Cycles à activer automatiquement depuis le référentiel national à la
  // création (par défaut : les 3 cycles scolaires, hors universitaire).
  cycles:        z.array(z.enum(['PRIMAIRE', 'COLLEGE', 'LYCEE'])).optional(),
  // Numéros de division à créer par défaut pour chaque niveau SANS série
  // (ex: ['1','2'] crée "6ème 1" ET "6ème 2"). Par défaut : ['1','2','3','4'].
  // Les lettres (A/C/D...) restent réservées aux séries de lycée.
  divisions:     z.array(z.string().min(1).max(5)).optional(),
});

// ── Niveau ────────────────────────────────────────────────────
export const CreateLevelSchema = z.object({
  schoolId: z.string().uuid(),
  nom:      z.string().min(1).max(100),
  type:     z.enum(['PRIMAIRE', 'COLLEGE', 'LYCEE']),
  ordre:    z.number().int().min(1),
});

// ── Classe ────────────────────────────────────────────────────
export const CreateClassSchema = z.object({
  schoolId:      z.string().uuid(),
  levelId:       z.string().uuid(),
  nom:           z.string().min(1).max(50),
  anneeScolaire: z.string().regex(/^\d{4}-\d{4}$/),
});

// ── Matière ───────────────────────────────────────────────────
export const CreateSubjectSchema = z.object({
  schoolId:    z.string().uuid(),
  nom:         z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// ── ClassSubject ──────────────────────────────────────────────
export const AssignClassSubjectSchema = z.object({
  classId:             z.string().uuid(),
  subjectId:           z.string().uuid(),
  teacherMembershipId: z.string().uuid(),
  coefficient:         z.number().min(0.5).max(10),
  hoursPerWeek:        z.number().int().min(1).max(20).optional(),
});

// ── Élève ─────────────────────────────────────────────────────
export const CreateStudentSchema = z.object({
  schoolId:      z.string().uuid(),
  classId:       z.string().uuid(),
  nom:           z.string().min(2).max(100),
  prenom:        z.string().min(2).max(100),
  email:         z.string().email().optional(),
  phone:         z.string().max(20).optional(),
  dateNaissance: z.string().optional(),
  sexe:          z.enum(['M', 'F']).optional(),
  parentEmail:   z.string().email().optional(),
  parentNom:     z.string().max(100).optional(),
  parentPrenom:  z.string().max(100).optional(),
  parentPhone:   z.string().max(20).optional(),
  parentLien:    z.enum(['PERE', 'MERE', 'TUTEUR']).optional(),
});

// ── Note ──────────────────────────────────────────────────────
export const CreateGradeSchema = z.object({
  studentId:      z.string().uuid(),
  classSubjectId: z.string().uuid(),
  valeur:         z.number().min(0).max(20),
  typeEval:       z.enum(['DEVOIR', 'CONTROLE', 'EXAMEN', 'INTERRO']),
  trimestre:      z.enum(['T1', 'T2', 'T3']),
  dateSaisie:     z.string().optional(),
});

export const BulkCreateGradesSchema = z.object({
  classSubjectId: z.string().uuid(),
  trimestre:      z.enum(['T1', 'T2', 'T3']),
  typeEval:       z.enum(['DEVOIR', 'CONTROLE', 'EXAMEN', 'INTERRO']),
  dateSaisie:     z.string().optional(),
  grades: z.array(z.object({
    studentId: z.string().uuid(),
    valeur:    z.number().min(0).max(20),
  })).min(1),
});

// ── Présence ──────────────────────────────────────────────────
export const MarkAttendanceSchema = z.object({
  classSubjectId: z.string().uuid(),
  date:           z.string(),
  records: z.array(z.object({
    studentId: z.string().uuid(),
    statut:    z.enum(['PRESENT', 'ABSENT', 'RETARD']),
    motif:     z.string().max(500).optional(),
  })).min(1),
});

// ── Paiement ──────────────────────────────────────────────────
export const UpdatePaymentStatusSchema = z.object({
  studentId:     z.string().uuid(),
  anneeScolaire: z.string().regex(/^\d{4}-\d{4}$/),
  mois:          z.array(z.number().int().min(1).max(9)).min(1),
  statut:        z.enum(['IMPAYE', 'PAYE', 'EXONERE', 'PARTIEL', 'ANNULE']),
});

// Paiement en présentiel (guichet) : espèces ou tout autre moyen local
export const RecordManualPaymentSchema = z.object({
  studentId:     z.string().uuid(),
  mois:          z.number().int().min(1).max(9),
  anneeScolaire: z.string().regex(/^\d{4}-\d{4}$/),
  montant:       z.number().positive('Le montant doit être supérieur à 0'),
  mode:          z.enum(['ESPECES', 'VIREMENT', 'CHEQUE', 'AUTRE']),
  observations:  z.string().max(500).optional(),
});

export const CancelPaymentTransactionSchema = z.object({
  transactionId: z.string().uuid(),
  observations:  z.string().max(500).optional(),
});

// Paiement à distance simulé (Mobile Money), en XAF
export const InitiateRemotePaymentSchema = z.object({
  studentId:       z.string().uuid(),
  mois:            z.number().int().min(1).max(9),
  anneeScolaire:   z.string().regex(/^\d{4}-\d{4}$/),
  montant:         z.number().positive('Le montant doit être supérieur à 0'),
  numeroTelephone: z.string().min(8).max(20),
});

// ── Bulletin ──────────────────────────────────────────────────
export const GenerateBulletinsSchema = z.object({
  classId:       z.string().uuid(),
  trimestre:     z.enum(['T1', 'T2', 'T3']),
  anneeScolaire: z.string().regex(/^\d{4}-\d{4}$/),
});

// ── Message ───────────────────────────────────────────────────
export const SendMessageSchema = z.object({
  schoolId:   z.string().uuid(),
  receiverId: z.string().uuid(),
  sujet:      z.string().min(1).max(255),
  contenu:    z.string().min(1).max(10000),
});

// ── Annonce ───────────────────────────────────────────────────
export const CreateAnnouncementSchema = z.object({
  schoolId: z.string().uuid(),
  titre:    z.string().min(1).max(255),
  contenu:  z.string().min(1).max(10000),
  cible:    z.enum(['ALL', 'PARENTS', 'TEACHERS', 'STUDENTS', 'ADMINS']),
});
