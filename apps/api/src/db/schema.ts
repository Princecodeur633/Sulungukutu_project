import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  numeric,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// ENUMS
// ============================================================

export const roleEnum = pgEnum('role', [
  'SUPER_ADMIN',
  'ADMIN',
  'TEACHER',
  'PARENT',
  'STUDENT',
]);

export const genderEnum = pgEnum('gender', ['M', 'F']);

export const parentLinkEnum = pgEnum('parent_link', ['PERE', 'MERE', 'TUTEUR']);

export const levelTypeEnum = pgEnum('level_type', [
  'PRIMAIRE',
  'COLLEGE',
  'LYCEE',
  'UNIVERSITAIRE',
]);

export const evalTypeEnum = pgEnum('eval_type', [
  'DEVOIR',
  'CONTROLE',
  'EXAMEN',
  'INTERRO',
]);

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'PRESENT',
  'ABSENT',
  'RETARD',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'IMPAYE',
  'PARTIEL',
  'PAYE',
  'ANNULE',
  'EXONERE',
]);

// Mode de règlement d'une transaction de paiement
export const paymentModeEnum = pgEnum('payment_mode', [
  'ESPECES',
  'MOBILE_MONEY',
  'MOBILE_MONEY_SIMULE',
  'VIREMENT',
  'CHEQUE',
  'AUTRE',
]);

// Canal par lequel la transaction a été initiée
export const transactionChannelEnum = pgEnum('transaction_channel', [
  'GUICHET',   // paiement en présentiel, saisi par un agent de l'établissement
  'DISTANCE',  // paiement à distance (simulation mobile money)
]);

// Statut du cycle de vie d'une transaction (indépendant du statut mensuel du paiement)
export const transactionStatusEnum = pgEnum('transaction_status', [
  'EN_ATTENTE',
  'VALIDEE',
  'ECHOUEE',
  'ANNULEE',
]);

// Code d'échec détaillé (uniquement renseigné quand statut = ECHOUEE)
export const transactionFailureCodeEnum = pgEnum('transaction_failure_code', [
  'SOLDE_INSUFFISANT',
  'NUMERO_INVALIDE',
  'ERREUR_RESEAU',
  'DELAI_EXPIRE',
]);

export const bulletinStatusEnum = pgEnum('bulletin_status', [
  'BROUILLON',
  'PUBLIE',
  'ARCHIVE',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'PAIEMENT',
  'ABSENCE',
  'BULLETIN',
  'ANNONCE',
  'SYSTEME',
  'MESSAGE',
]);

export const announcementTargetEnum = pgEnum('announcement_target', [
  'ALL',
  'PARENTS',
  'TEACHERS',
  'STUDENTS',
  'ADMINS',
]);

export const membershipStatusEnum = pgEnum('membership_status', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
]);

export const trimesterEnum = pgEnum('trimester', ['T1', 'T2', 'T3']);

export const mentionEnum = pgEnum('mention', [
  'EXCELLENT',
  'TRES_BIEN',
  'BIEN',
  'ASSEZ_BIEN',
  'PASSABLE',
  'INSUFFISANT',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_EXONERATED',
  'PAYMENT_TRANSACTION_CREATED',
  'PAYMENT_TRANSACTION_CANCELLED',
  'REMOTE_PAYMENT_INITIATED',
  'REMOTE_PAYMENT_RESOLVED',
  'BULLETIN_GENERATED',
  'BULLETIN_UPDATED',
  'BULLETIN_DELETED',
  'BULLETIN_PUBLISHED',
  'BULLETIN_ARCHIVED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'USER_INVITED',
  'USER_ROLE_CHANGED',
  'GRADE_CREATED',
  'GRADE_UPDATED',
  'GRADE_DELETED',
  'ATTENDANCE_MARKED',
  'ATTENDANCE_UPDATED',
  'SCHOOL_CREATED',
  'SCHOOL_UPDATED',
  'CLASS_CREATED',
  'CLASS_UPDATED',
  'CLASS_DELETED',
  'SUBJECT_CREATED',
  'SUBJECT_UPDATED',
  'SUBJECT_DELETED',
  'CLASS_SUBJECT_ASSIGNED',
  'CLASS_SUBJECT_UNASSIGNED',
  'ANNOUNCEMENT_CREATED',
  'ANNOUNCEMENT_DELETED',
  'IDENTITY_GENERATED',
  'IDENTITY_CONFLICT_RESOLVED',
  'SCHOOL_PEDAGOGY_PROVISIONED',
  'SCHOOL_LEVEL_TOGGLED',
  'SCHOOL_SUBJECT_TOGGLED',
]);

// ============================================================
// TABLES
// ============================================================

// ── Profils Globaux ──────────────────────────────────────────
export const globalProfiles = pgTable(
  'global_profiles',
  {
    id:           uuid('id').primaryKey().defaultRandom(),
    code:         varchar('code', { length: 20 }).unique().notNull(),
    nom:          varchar('nom', { length: 100 }).notNull(),
    prenom:       varchar('prenom', { length: 100 }).notNull(),
    email:        varchar('email', { length: 255 }).unique().notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    // Avant : aucune contrainte d'unicité en base sur le téléphone —
    // seule une vérification applicative (LIKE) protégeait contre les
    // doublons, non fiable en cas de requêtes simultanées. NULL reste
    // autorisé plusieurs fois (Postgres ne compare jamais deux NULL comme
    // égaux dans une contrainte UNIQUE).
    phone:        varchar('phone', { length: 20 }).unique(),
    avatarUrl:    text('avatar_url'),
    isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
    // Permet d'invalider les JWT déjà émis après un changement de mot de passe
    // (comparaison avec le claim `iat` du token).
    passwordChangedAt: timestamp('password_changed_at'),
    createdAt:    timestamp('created_at').defaultNow().notNull(),
    updatedAt:    timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index('global_profiles_email_idx').on(t.email),
    codeIdx:  index('global_profiles_code_idx').on(t.code),
  })
);

// ── Établissements ───────────────────────────────────────────
export const schools = pgTable(
  'schools',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    code:          varchar('code', { length: 20 }).unique().notNull(),
    nom:           varchar('nom', { length: 200 }).notNull(),
    logoUrl:       text('logo_url'),
    adresse:       text('adresse'),
    telephone:     varchar('telephone', { length: 20 }),
    anneeScolaire: varchar('annee_scolaire', { length: 10 }).notNull(),
    accentColor:   varchar('accent_color', { length: 20 }),
    isActive:      boolean('is_active').default(true).notNull(),
    createdAt:     timestamp('created_at').defaultNow().notNull(),
    updatedAt:     timestamp('updated_at').defaultNow().notNull(),
  }
);

// ── School Memberships ───────────────────────────────────────
export const schoolMemberships = pgTable(
  'school_memberships',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
                 .references(() => globalProfiles.id, { onDelete: 'cascade' })
                 .notNull(),
    schoolId:  uuid('school_id')
                 .references(() => schools.id, { onDelete: 'cascade' })
                 .notNull(),
    role:      roleEnum('role').notNull(),
    code:      varchar('code', { length: 20 }).unique().notNull(),
    status:    membershipStatusEnum('status').default('ACTIVE').notNull(),
    joinedAt:  timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => ({
    profileSchoolIdx: uniqueIndex('membership_profile_school_idx').on(
      t.profileId,
      t.schoolId,
      t.role
    ),
    schoolRoleIdx: index('membership_school_role_idx').on(t.schoolId, t.role),
  })
);

// ============================================================
// RÉFÉRENTIEL NATIONAL (Congo-Brazzaville) — données globales,
// mutualisées entre tous les établissements. Aucune colonne schoolId
// ici : c'est la source de vérité pédagogique nationale, gérée par le
// Super Admin uniquement. Les écoles n'y écrivent jamais directement ;
// elles "activent" un sous-ensemble via levels.nationalLevelId /
// subjects.nationalSubjectId (voir plus bas).
//
// NOTE : le cycle UNIVERSITAIRE existe encore dans `levelTypeEnum` pour
// compatibilité (PostgreSQL ne permet pas de retirer une valeur d'un
// type enum sans reconstruire le type). Il n'est simplement plus utilisé
// ni proposé par le référentiel national : seuls PRIMAIRE, COLLEGE et
// LYCEE sont seedés et exposés à la création d'un établissement.
// ============================================================

// ── Niveaux nationaux (CP1 → Terminale) ──────────────────────
export const nationalLevels = pgTable(
  'national_levels',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    cycle:     levelTypeEnum('cycle').notNull(),
    nom:       varchar('nom', { length: 100 }).notNull(),   // ex: "6ème", "Terminale"
    ordre:     integer('ordre').notNull(),                  // ordre global toutes cycles confondus
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    cycleIdx: index('national_levels_cycle_idx').on(t.cycle),
  })
);

// ── Séries nationales (Lycée uniquement : A, C, D, TI...) ────
export const nationalSeries = pgTable(
  'national_series',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    code:      varchar('code', { length: 10 }).unique().notNull(),  // "A", "C", "D", "TI"
    nom:       varchar('nom', { length: 150 }).notNull(),           // "Littéraire", "Maths-Physique"...
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

// ── Matières nationales ───────────────────────────────────────
export const nationalSubjects = pgTable(
  'national_subjects',
  {
    id:          uuid('id').primaryKey().defaultRandom(),
    code:        varchar('code', { length: 20 }).unique().notNull(),
    nom:         varchar('nom', { length: 100 }).notNull(),
    createdAt:   timestamp('created_at').defaultNow().notNull(),
  }
);

// ── Grille officielle : niveau (+ série éventuelle) × matière ─
// Coefficients/volumes horaires "par défaut" copiés vers chaque école à
// la provision ; modifiables ensuite localement via classSubjects.coefficient
// / classSubjects.hoursPerWeek sans jamais toucher à cette table nationale.
export const nationalCurriculum = pgTable(
  'national_curriculum',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    nationalLevelId:  uuid('national_level_id')
                        .references(() => nationalLevels.id, { onDelete: 'cascade' })
                        .notNull(),
    nationalSeriesId: uuid('national_series_id')
                        .references(() => nationalSeries.id, { onDelete: 'cascade' }),
    nationalSubjectId: uuid('national_subject_id')
                        .references(() => nationalSubjects.id, { onDelete: 'cascade' })
                        .notNull(),
    coefficient:      numeric('coefficient', { precision: 4, scale: 2 }).notNull(),
    volumeHoraireHebdo: integer('volume_horaire_hebdo'),
    createdAt:        timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    curriculumUniq: uniqueIndex('national_curriculum_unique_idx').on(
      t.nationalLevelId, t.nationalSeriesId, t.nationalSubjectId
    ),
  })
);

// ============================================================
// DONNÉES ÉTABLISSEMENT — activation/personnalisation du référentiel
// ============================================================

// ── Niveaux ──────────────────────────────────────────────────
export const levels = pgTable(
  'levels',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    schoolId:  uuid('school_id')
                 .references(() => schools.id, { onDelete: 'cascade' })
                 .notNull(),
    // Référence vers le référentiel national dont ce niveau est l'activation.
    // Nullable pour ne pas casser les niveaux déjà créés avant cette
    // migration (écoles existantes) ; à terme, tout nouveau niveau devrait
    // en avoir un (imposé au niveau du resolver, pas de la base).
    nationalLevelId: uuid('national_level_id').references(() => nationalLevels.id),
    isActive:  boolean('is_active').default(true).notNull(),
    // Soft delete : une école ne supprime jamais physiquement sa copie
    // tenant, elle est seulement masquée. Le référentiel national, lui,
    // n'est jamais touché par cette opération (tables séparées).
    deletedAt: timestamp('deleted_at'),
    nom:       varchar('nom', { length: 100 }).notNull(),
    type:      levelTypeEnum('type').notNull(),
    ordre:     integer('ordre').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    schoolIdx: index('levels_school_idx').on(t.schoolId),
    nationalLevelIdx: index('levels_national_level_idx').on(t.nationalLevelId),
  })
);

// ── Classes ──────────────────────────────────────────────────
export const classes = pgTable(
  'classes',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    schoolId:      uuid('school_id')
                     .references(() => schools.id, { onDelete: 'cascade' })
                     .notNull(),
    levelId:       uuid('level_id')
                     .references(() => levels.id, { onDelete: 'cascade' })
                     .notNull(),
    // Série nationale (Lycée) le cas échéant — ex: classe "Terminale D1"
    // = niveau "Terminale" + série "D". Reste nul pour primaire/collège.
    nationalSeriesId: uuid('national_series_id').references(() => nationalSeries.id),
    nom:           varchar('nom', { length: 50 }).notNull(),  // division locale, ex: "6ème A"
    anneeScolaire: varchar('annee_scolaire', { length: 10 }).notNull(),
    isActive:      boolean('is_active').default(true).notNull(),
    deletedAt:     timestamp('deleted_at'),
    createdAt:     timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    schoolIdx: index('classes_school_idx').on(t.schoolId),
    levelIdx:  index('classes_level_idx').on(t.levelId),
  })
);

// ── Matières ─────────────────────────────────────────────────
export const subjects = pgTable(
  'subjects',
  {
    id:          uuid('id').primaryKey().defaultRandom(),
    schoolId:    uuid('school_id')
                   .references(() => schools.id, { onDelete: 'cascade' })
                   .notNull(),
    nationalSubjectId: uuid('national_subject_id').references(() => nationalSubjects.id),
    isActive:    boolean('is_active').default(true).notNull(),
    deletedAt:   timestamp('deleted_at'),
    nom:         varchar('nom', { length: 100 }).notNull(),
    description: text('description'),
    createdAt:   timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    schoolIdx: index('subjects_school_idx').on(t.schoolId),
  })
);

// ── ClassSubjects (Pivot Classe × Matière × Enseignant) ──────
export const classSubjects = pgTable(
  'class_subjects',
  {
    id:                  uuid('id').primaryKey().defaultRandom(),
    classId:             uuid('class_id')
                           .references(() => classes.id, { onDelete: 'cascade' })
                           .notNull(),
    subjectId:           uuid('subject_id')
                           .references(() => subjects.id, { onDelete: 'cascade' })
                           .notNull(),
    teacherMembershipId: uuid('teacher_membership_id')
                           .references(() => schoolMemberships.id, { onDelete: 'cascade' })
                           .notNull(),
    coefficient:         numeric('coefficient', { precision: 4, scale: 2 }).notNull(),
    hoursPerWeek:        integer('hours_per_week'),
    // Soft delete : un DELETE physique sur cette table cascade (onDelete
    // 'cascade') sur TOUTES les notes ET présences liées à cette affectation
    // classe/matière/enseignant — perte de données réelle et irréversible.
    isActive:            boolean('is_active').default(true).notNull(),
    deletedAt:           timestamp('deleted_at'),
    createdAt:           timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    classSubjectUniq: uniqueIndex('class_subject_unique_idx').on(
      t.classId,
      t.subjectId
    ),
    teacherIdx: index('class_subjects_teacher_idx').on(t.teacherMembershipId),
  })
);

// ── Élèves ───────────────────────────────────────────────────
export const students = pgTable(
  'students',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    membershipId:  uuid('membership_id')
                     .references(() => schoolMemberships.id, { onDelete: 'cascade' })
                     .notNull(),
    classId:       uuid('class_id')
                     .references(() => classes.id)
                     .notNull(),
    matricule:     varchar('matricule', { length: 20 }).unique().notNull(),
    dateNaissance: date('date_naissance'),
    sexe:          genderEnum('sexe'),
    isActive:      boolean('is_active').default(true).notNull(),
    deletedAt:     timestamp('deleted_at'),
    createdAt:     timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    classIdx:      index('students_class_idx').on(t.classId),
    matriculeIdx:  index('students_matricule_idx').on(t.matricule),
  })
);

// ── Liens Parent ↔ Élève ─────────────────────────────────────
export const parentStudents = pgTable(
  'parent_students',
  {
    id:                 uuid('id').primaryKey().defaultRandom(),
    parentMembershipId: uuid('parent_membership_id')
                          .references(() => schoolMemberships.id, { onDelete: 'cascade' })
                          .notNull(),
    studentId:          uuid('student_id')
                          .references(() => students.id, { onDelete: 'cascade' })
                          .notNull(),
    lien:               parentLinkEnum('lien').notNull(),
  },
  (t) => ({
    parentStudentUniq: uniqueIndex('parent_student_unique_idx').on(
      t.parentMembershipId,
      t.studentId
    ),
  })
);

// ── Notes ────────────────────────────────────────────────────
export const grades = pgTable(
  'grades',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    studentId:      uuid('student_id')
                      .references(() => students.id, { onDelete: 'cascade' })
                      .notNull(),
    classSubjectId: uuid('class_subject_id')
                      .references(() => classSubjects.id, { onDelete: 'cascade' })
                      .notNull(),
    valeur:         numeric('valeur', { precision: 5, scale: 2 }).notNull(),
    typeEval:       evalTypeEnum('type_eval').notNull(),
    trimestre:      trimesterEnum('trimestre').notNull(),
    dateSaisie:     timestamp('date_saisie').defaultNow().notNull(),
    enseignantId:   uuid('enseignant_id')
                      .references(() => schoolMemberships.id)
                      .notNull(),
    isActive:       boolean('is_active').default(true).notNull(),
    deletedAt:      timestamp('deleted_at'),
    createdAt:      timestamp('created_at').defaultNow().notNull(),
    updatedAt:      timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    studentTrimestreIdx: index('grades_student_trimestre_idx').on(
      t.studentId,
      t.trimestre
    ),
    classSubjectIdx: index('grades_class_subject_idx').on(t.classSubjectId),
  })
);

// ── Présences ────────────────────────────────────────────────
export const attendances = pgTable(
  'attendances',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    studentId:      uuid('student_id')
                      .references(() => students.id, { onDelete: 'cascade' })
                      .notNull(),
    classSubjectId: uuid('class_subject_id')
                      .references(() => classSubjects.id, { onDelete: 'cascade' })
                      .notNull(),
    date:           date('date').notNull(),
    statut:         attendanceStatusEnum('statut').notNull(),
    motif:          text('motif'),
    markedById:     uuid('marked_by_id')
                      .references(() => schoolMemberships.id)
                      .notNull(),
    isActive:       boolean('is_active').default(true).notNull(),
    deletedAt:      timestamp('deleted_at'),
    createdAt:      timestamp('created_at').defaultNow().notNull(),
    updatedAt:      timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    studentDateIdx: uniqueIndex('attendance_student_date_cs_idx').on(
      t.studentId,
      t.classSubjectId,
      t.date
    ),
    dateIdx: index('attendances_date_idx').on(t.date),
  })
);

// ── Paiements (dû mensuel + statut agrégé) ───────────────────
export const payments = pgTable(
  'payments',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    studentId:     uuid('student_id')
                     .references(() => students.id, { onDelete: 'cascade' })
                     .notNull(),
    mois:          integer('mois').notNull(),
    anneeScolaire: varchar('annee_scolaire', { length: 10 }).notNull(),
    statut:        paymentStatusEnum('statut').default('IMPAYE').notNull(),
    // Montant dû pour ce mois et cumul réellement encaissé (somme des transactions VALIDEE).
    // montantPaye est dérivé/recalculé par paymentService, jamais modifié à la main ailleurs.
    montantDu:     numeric('montant_du', { precision: 10, scale: 2 }).default('0').notNull(),
    montantPaye:   numeric('montant_paye', { precision: 10, scale: 2 }).default('0').notNull(),
    datePaiement:  timestamp('date_paiement'),
    updatedById:   uuid('updated_by_id')
                     .references(() => schoolMemberships.id),
    createdAt:     timestamp('created_at').defaultNow().notNull(),
    updatedAt:     timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    studentMoisUniq: uniqueIndex('payment_student_mois_annee_idx').on(
      t.studentId,
      t.mois,
      t.anneeScolaire
    ),
    studentIdx: index('payments_student_idx').on(t.studentId),
  })
);

// ── Transactions de paiement (journal immuable) ──────────────
// Chaque opération (encaissement guichet, tentative de paiement à distance,
// annulation) est une ligne. On n'update jamais une ligne VALIDEE : une
// annulation crée une nouvelle ligne ANNULEE qui référence la transaction
// d'origine. C'est cette table qui sert d'historique complet et de source
// pour le recalcul de payments.montantPaye / payments.statut.
export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id:              uuid('id').primaryKey().defaultRandom(),
    paymentId:       uuid('payment_id')
                       .references(() => payments.id, { onDelete: 'cascade' })
                       .notNull(),
    studentId:       uuid('student_id')
                       .references(() => students.id, { onDelete: 'cascade' })
                       .notNull(),
    montant:         numeric('montant', { precision: 10, scale: 2 }).notNull(),
    devise:          varchar('devise', { length: 3 }).default('XAF').notNull(),
    mode:            paymentModeEnum('mode').notNull(),
    canal:           transactionChannelEnum('canal').notNull(),
    statut:          transactionStatusEnum('statut').default('EN_ATTENTE').notNull(),
    codeEchec:       transactionFailureCodeEnum('code_echec'),
    numeroTelephone: varchar('numero_telephone', { length: 20 }),
    numeroRecu:      varchar('numero_recu', { length: 30 }).unique(),
    transactionRef:  varchar('transaction_ref', { length: 64 }).unique().notNull(),
    agentId:         uuid('agent_id').references(() => schoolMemberships.id),
    observations:    text('observations'),
    annuleTransactionId: uuid('annule_transaction_id'),
    createdAt:       timestamp('created_at').defaultNow().notNull(),
    updatedAt:       timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    paymentIdx: index('payment_transactions_payment_idx').on(t.paymentId),
    studentIdx: index('payment_transactions_student_idx').on(t.studentId),
    statutIdx:  index('payment_transactions_statut_idx').on(t.statut),
  })
);

// ── Bulletins ────────────────────────────────────────────────
export const bulletins = pgTable(
  'bulletins',
  {
    id:              uuid('id').primaryKey().defaultRandom(),
    studentId:       uuid('student_id')
                       .references(() => students.id, { onDelete: 'cascade' })
                       .notNull(),
    trimestre:       trimesterEnum('trimestre').notNull(),
    anneeScolaire:   varchar('annee_scolaire', { length: 10 }).notNull(),
    statut:          bulletinStatusEnum('statut').default('BROUILLON').notNull(),
    pdfUrl:          text('pdf_url'),
    moyenneGenerale: numeric('moyenne_generale', { precision: 5, scale: 2 }),
    rang:            integer('rang'),
    mention:         mentionEnum('mention'),
    generatedAt:     timestamp('generated_at'),
    deletedAt:       timestamp('deleted_at'),
    updatedAt:       timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    studentTrimestreUniq: uniqueIndex('bulletin_student_trimestre_annee_idx').on(
      t.studentId,
      t.trimestre,
      t.anneeScolaire
    ),
  })
);

// ── Détails Bulletins ────────────────────────────────────────
export const bulletinDetails = pgTable(
  'bulletin_details',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    bulletinId:     uuid('bulletin_id')
                      .references(() => bulletins.id, { onDelete: 'cascade' })
                      .notNull(),
    classSubjectId: uuid('class_subject_id')
                      .references(() => classSubjects.id)
                      .notNull(),
    moyenneMatiere: numeric('moyenne_matiere', { precision: 5, scale: 2 }).notNull(),
    coefficient:    numeric('coefficient', { precision: 4, scale: 2 }).notNull(),
    pointsObtenus:  numeric('points_obtenus', { precision: 6, scale: 2 }).notNull(),
    appreciation:   varchar('appreciation', { length: 200 }),
  },
  (t) => ({
    bulletinIdx: index('bulletin_details_bulletin_idx').on(t.bulletinId),
  })
);

// ── Emplois du Temps ─────────────────────────────────────────
export const schedules = pgTable(
  'schedules',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    classSubjectId: uuid('class_subject_id')
                      .references(() => classSubjects.id, { onDelete: 'cascade' })
                      .notNull(),
    jour:           integer('jour').notNull(),
    heureDebut:     varchar('heure_debut', { length: 5 }).notNull(),
    heureFin:       varchar('heure_fin', { length: 5 }).notNull(),
    salle:          varchar('salle', { length: 50 }),
    createdAt:      timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    classSubjectJourIdx: index('schedules_cs_jour_idx').on(
      t.classSubjectId,
      t.jour
    ),
  })
);

// ── Messages ─────────────────────────────────────────────────
export const messages = pgTable(
  'messages',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    schoolId:   uuid('school_id')
                  .references(() => schools.id, { onDelete: 'cascade' })
                  .notNull(),
    senderId:   uuid('sender_id')
                  .references(() => schoolMemberships.id)
                  .notNull(),
    receiverId: uuid('receiver_id')
                  .references(() => schoolMemberships.id)
                  .notNull(),
    sujet:      varchar('sujet', { length: 255 }).notNull(),
    contenu:    text('contenu').notNull(),
    lu:         boolean('lu').default(false).notNull(),
    createdAt:  timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    receiverIdx: index('messages_receiver_idx').on(t.receiverId),
    senderIdx:   index('messages_sender_idx').on(t.senderId),
  })
);

// ── Notifications ────────────────────────────────────────────
export const notifications = pgTable(
  'notifications',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
                 .references(() => globalProfiles.id, { onDelete: 'cascade' })
                 .notNull(),
    schoolId:  uuid('school_id')
                 .references(() => schools.id, { onDelete: 'cascade' }),
    titre:     varchar('titre', { length: 255 }).notNull(),
    message:   text('message').notNull(),
    type:      notificationTypeEnum('type').notNull(),
    lu:        boolean('lu').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    profileIdx: index('notifications_profile_idx').on(t.profileId),
    luIdx:      index('notifications_lu_idx').on(t.profileId, t.lu),
  })
);

// ── Annonces ─────────────────────────────────────────────────
export const announcements = pgTable(
  'announcements',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    schoolId:  uuid('school_id')
                 .references(() => schools.id, { onDelete: 'cascade' })
                 .notNull(),
    auteurId:  uuid('auteur_id')
                 .references(() => schoolMemberships.id)
                 .notNull(),
    titre:     varchar('titre', { length: 255 }).notNull(),
    contenu:   text('contenu').notNull(),
    cible:     announcementTargetEnum('cible').notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    schoolIdx: index('announcements_school_idx').on(t.schoolId),
  })
);

// ── Audit Logs ───────────────────────────────────────────────
export const auditLogs = pgTable(
  'audit_logs',
  {
    id:          uuid('id').primaryKey().defaultRandom(),
    schoolId:    uuid('school_id')
                   .references(() => schools.id, { onDelete: 'cascade' })
                   .notNull(),
    actorId:     uuid('actor_id')
                   .references(() => schoolMemberships.id)
                   .notNull(),
    action:      auditActionEnum('action').notNull(),
    entityType:  varchar('entity_type', { length: 50 }).notNull(),
    entityId:    uuid('entity_id').notNull(),
    oldValue:    jsonb('old_value'),
    newValue:    jsonb('new_value'),
    description: text('description'),
    createdAt:   timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    schoolIdx:  index('audit_logs_school_idx').on(t.schoolId),
    actorIdx:   index('audit_logs_actor_idx').on(t.actorId),
    actionIdx:  index('audit_logs_action_idx').on(t.action),
    dateIdx:    index('audit_logs_date_idx').on(t.createdAt),
  })
);

// ============================================================
// RELATIONS DRIZZLE
// ============================================================

export const globalProfilesRelations = relations(globalProfiles, ({ many }) => ({
  memberships:   many(schoolMemberships),
  notifications: many(notifications),
}));

export const schoolsRelations = relations(schools, ({ many }) => ({
  memberships:   many(schoolMemberships),
  levels:        many(levels),
  classes:       many(classes),
  subjects:      many(subjects),
  messages:      many(messages),
  notifications: many(notifications),
  announcements: many(announcements),
  auditLogs:     many(auditLogs),
}));

export const schoolMembershipsRelations = relations(
  schoolMemberships,
  ({ one, many }) => ({
    profile:          one(globalProfiles, {
      fields:      [schoolMemberships.profileId],
      references:  [globalProfiles.id],
    }),
    school:           one(schools, {
      fields:      [schoolMemberships.schoolId],
      references:  [schools.id],
    }),
    studentProfile:   many(students),
    classSubjects:    many(classSubjects),
    sentMessages:     many(messages, { relationName: 'sender' }),
    receivedMessages: many(messages, { relationName: 'receiver' }),
    auditLogs:        many(auditLogs),
  })
);

export const levelsRelations = relations(levels, ({ one, many }) => ({
  school:       one(schools,       { fields: [levels.schoolId], references: [schools.id] }),
  nationalLevel: one(nationalLevels, { fields: [levels.nationalLevelId], references: [nationalLevels.id] }),
  classes:      many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  school:        one(schools,  { fields: [classes.schoolId], references: [schools.id] }),
  level:         one(levels,   { fields: [classes.levelId],  references: [levels.id] }),
  nationalSeries: one(nationalSeries, { fields: [classes.nationalSeriesId], references: [nationalSeries.id] }),
  classSubjects: many(classSubjects),
  students:      many(students),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  school:          one(schools, { fields: [subjects.schoolId], references: [schools.id] }),
  nationalSubject: one(nationalSubjects, { fields: [subjects.nationalSubjectId], references: [nationalSubjects.id] }),
  classSubjects:   many(classSubjects),
}));

export const nationalLevelsRelations = relations(nationalLevels, ({ many }) => ({
  schoolLevels: many(levels),
  curriculum:   many(nationalCurriculum),
}));

export const nationalSeriesRelations = relations(nationalSeries, ({ many }) => ({
  schoolClasses: many(classes),
  curriculum:    many(nationalCurriculum),
}));

export const nationalSubjectsRelations = relations(nationalSubjects, ({ many }) => ({
  schoolSubjects: many(subjects),
  curriculum:     many(nationalCurriculum),
}));

export const nationalCurriculumRelations = relations(nationalCurriculum, ({ one }) => ({
  level:   one(nationalLevels,  { fields: [nationalCurriculum.nationalLevelId],   references: [nationalLevels.id] }),
  series:  one(nationalSeries,  { fields: [nationalCurriculum.nationalSeriesId],  references: [nationalSeries.id] }),
  subject: one(nationalSubjects, { fields: [nationalCurriculum.nationalSubjectId], references: [nationalSubjects.id] }),
}));

export const classSubjectsRelations = relations(classSubjects, ({ one, many }) => ({
  class:       one(classes,           { fields: [classSubjects.classId],             references: [classes.id] }),
  subject:     one(subjects,          { fields: [classSubjects.subjectId],           references: [subjects.id] }),
  teacher:     one(schoolMemberships, { fields: [classSubjects.teacherMembershipId], references: [schoolMemberships.id] }),
  grades:      many(grades),
  attendances: many(attendances),
  schedules:   many(schedules),
  bulletinDetails: many(bulletinDetails),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  membership:  one(schoolMemberships, { fields: [students.membershipId], references: [schoolMemberships.id] }),
  class:       one(classes,           { fields: [students.classId],      references: [classes.id] }),
  parents:     many(parentStudents),
  grades:      many(grades),
  attendances: many(attendances),
  payments:    many(payments),
  bulletins:   many(bulletins),
}));

export const parentStudentsRelations = relations(parentStudents, ({ one }) => ({
  parent:  one(schoolMemberships, { fields: [parentStudents.parentMembershipId], references: [schoolMemberships.id] }),
  student: one(students,          { fields: [parentStudents.studentId],          references: [students.id] }),
}));

export const gradesRelations = relations(grades, ({ one }) => ({
  student:      one(students,          { fields: [grades.studentId],      references: [students.id] }),
  classSubject: one(classSubjects,     { fields: [grades.classSubjectId], references: [classSubjects.id] }),
  enseignant:   one(schoolMemberships, { fields: [grades.enseignantId],   references: [schoolMemberships.id] }),
}));

export const attendancesRelations = relations(attendances, ({ one }) => ({
  student:      one(students,          { fields: [attendances.studentId],      references: [students.id] }),
  classSubject: one(classSubjects,     { fields: [attendances.classSubjectId], references: [classSubjects.id] }),
  markedBy:     one(schoolMemberships, { fields: [attendances.markedById],     references: [schoolMemberships.id] }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  student:      one(students,          { fields: [payments.studentId],   references: [students.id] }),
  updatedBy:    one(schoolMemberships, { fields: [payments.updatedById], references: [schoolMemberships.id] }),
  transactions: many(paymentTransactions),
}));

export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  payment: one(payments,          { fields: [paymentTransactions.paymentId], references: [payments.id] }),
  student: one(students,          { fields: [paymentTransactions.studentId], references: [students.id] }),
  agent:   one(schoolMemberships, { fields: [paymentTransactions.agentId],   references: [schoolMemberships.id] }),
}));

export const bulletinsRelations = relations(bulletins, ({ one, many }) => ({
  student: one(students, { fields: [bulletins.studentId], references: [students.id] }),
  details: many(bulletinDetails),
}));

export const bulletinDetailsRelations = relations(bulletinDetails, ({ one }) => ({
  bulletin:     one(bulletins,     { fields: [bulletinDetails.bulletinId],     references: [bulletins.id] }),
  classSubject: one(classSubjects, { fields: [bulletinDetails.classSubjectId], references: [classSubjects.id] }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  classSubject: one(classSubjects, { fields: [schedules.classSubjectId], references: [classSubjects.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  school:   one(schools,           { fields: [messages.schoolId],   references: [schools.id] }),
  sender:   one(schoolMemberships, { fields: [messages.senderId],   references: [schoolMemberships.id], relationName: 'sender' }),
  receiver: one(schoolMemberships, { fields: [messages.receiverId], references: [schoolMemberships.id], relationName: 'receiver' }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  profile: one(globalProfiles, { fields: [notifications.profileId], references: [globalProfiles.id] }),
  school:  one(schools,        { fields: [notifications.schoolId],  references: [schools.id] }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  school:  one(schools,           { fields: [announcements.schoolId], references: [schools.id] }),
  auteur:  one(schoolMemberships, { fields: [announcements.auteurId], references: [schoolMemberships.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  school: one(schools,           { fields: [auditLogs.schoolId], references: [schools.id] }),
  actor:  one(schoolMemberships, { fields: [auditLogs.actorId],  references: [schoolMemberships.id] }),
}));

// ── Types exportés ────────────────────────────────────────────
export type GlobalProfile    = typeof globalProfiles.$inferSelect;
export type NewGlobalProfile = typeof globalProfiles.$inferInsert;

export type School    = typeof schools.$inferSelect;
export type NewSchool = typeof schools.$inferInsert;

export type SchoolMembership    = typeof schoolMemberships.$inferSelect;
export type NewSchoolMembership = typeof schoolMemberships.$inferInsert;

export type Level    = typeof levels.$inferSelect;
export type NewLevel = typeof levels.$inferInsert;

export type NationalLevel    = typeof nationalLevels.$inferSelect;
export type NewNationalLevel = typeof nationalLevels.$inferInsert;

export type NationalSeries    = typeof nationalSeries.$inferSelect;
export type NewNationalSeries = typeof nationalSeries.$inferInsert;

export type NationalSubject    = typeof nationalSubjects.$inferSelect;
export type NewNationalSubject = typeof nationalSubjects.$inferInsert;

export type NationalCurriculum    = typeof nationalCurriculum.$inferSelect;
export type NewNationalCurriculum = typeof nationalCurriculum.$inferInsert;

export type Class    = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;

export type Subject    = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type ClassSubject    = typeof classSubjects.$inferSelect;
export type NewClassSubject = typeof classSubjects.$inferInsert;

export type Student    = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;

export type ParentStudent    = typeof parentStudents.$inferSelect;
export type NewParentStudent = typeof parentStudents.$inferInsert;

export type Grade    = typeof grades.$inferSelect;
export type NewGrade = typeof grades.$inferInsert;

export type Attendance    = typeof attendances.$inferSelect;
export type NewAttendance = typeof attendances.$inferInsert;

export type Payment    = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type PaymentTransaction    = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert;

export type Bulletin    = typeof bulletins.$inferSelect;
export type NewBulletin = typeof bulletins.$inferInsert;

export type BulletinDetail    = typeof bulletinDetails.$inferSelect;
export type NewBulletinDetail = typeof bulletinDetails.$inferInsert;

export type Schedule    = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;

export type Message    = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Notification    = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type Announcement    = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;

export type AuditLog    = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
