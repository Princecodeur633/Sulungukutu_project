/**
 * Seed sulungukutu — données de démonstration complètes et réalistes
 *
 * Idempotent : Super Admin est créé s'il manque ; l'école de démo n'est
 * recréée que si admin@demo-school.edu n'existe pas encore.
 *
 * Usage : pnpm --filter api db:seed
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool }    from 'pg';
import bcrypt      from 'bcryptjs';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from './schema';
import { bulletinService } from '../services/bulletin.service';
import { paymentService } from '../services/payment.service';
import { generateShortCode, generateMatricule } from '../utils/code-generator';

const client = new Pool({ connectionString: process.env.DATABASE_URL! });
const db     = drizzle(client, { schema });

async function hash(pwd: string) { return bcrypt.hash(pwd, 12); }

async function createProfile(data: {
  code: string; nom: string; prenom: string;
  email: string; password: string;
  phone?: string;
  isSuperAdmin?: boolean;
}) {
  const [profile] = await db.insert(schema.globalProfiles).values({
    code:         data.code,
    nom:          data.nom,
    prenom:       data.prenom,
    email:        data.email,
    phone:        data.phone ?? null,
    passwordHash: await hash(data.password),
    isSuperAdmin: data.isSuperAdmin ?? false,
  }).returning();
  return profile;
}

async function createMembership(
  profileId: string,
  schoolId: string,
  role: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT',
  prefix: 'ADM' | 'TCH' | 'PAR' | 'STU' | 'SUP',
  nom: string,
  prenom: string,
) {
  const [m] = await db.insert(schema.schoolMemberships).values({
    profileId, schoolId, role, code: generateShortCode(prefix, nom, prenom), status: 'ACTIVE',
  }).returning();
  return m;
}

function weekdayDates(count: number): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (dates.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() - 1);
  }
  return dates.reverse();
}

async function seed() {
  console.log('\n🌱 Démarrage du seed sulungukutu...\n');

  const { nationalReferentialService } = await import('../services/national-referential.service');
  await nationalReferentialService.seed(db);
  console.log('📚 Référentiel national pédagogique prêt (idempotent).');

  // ── 1. Super Admin ──────────────────────────────────────────
  const SA_EMAIL = process.env.SUPER_ADMIN_EMAIL    ?? 'superadmin@sulungukutu.com';
  const SA_PWD   = process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@2024!';

  const existingSa = await db.query.globalProfiles.findFirst({
    where: (t, { eq: e }) => e(t.email, SA_EMAIL),
  });
  if (!existingSa) {
    const saProfile = await createProfile({
      code: 'SUP-0001', nom: 'Admin', prenom: 'Super',
      email: SA_EMAIL, password: SA_PWD, isSuperAdmin: true,
    });

    const [sysSchool] = await db.insert(schema.schools).values({
      code: 'SYS-PLATFORM-001', nom: 'sulungukutu Platform',
      anneeScolaire: '2024-2025',
    }).returning();

    await db.insert(schema.schoolMemberships).values({
      profileId: saProfile.id,
      schoolId:  sysSchool.id,
      role:      'SUPER_ADMIN',
      code:      'SUP-0001',
      status:    'ACTIVE',
    }).onConflictDoNothing();
    console.log(`✅ Super Admin : ${SA_EMAIL}`);
  } else {
    if (!existingSa.isSuperAdmin) {
      await db.update(schema.globalProfiles)
        .set({ isSuperAdmin: true })
        .where(eq(schema.globalProfiles.id, existingSa.id));
    }
    console.log('ℹ️  Super Admin déjà existant');
  }

  // ── 2. École de démonstration ───────────────────────────────
  const DEMO_ADMIN = 'admin@demo-school.edu';
  const existingDemo = await db.query.globalProfiles.findFirst({
    where: (t, { eq: e }) => e(t.email, DEMO_ADMIN),
  });
  if (existingDemo) {
    console.log('ℹ️  École de démo déjà seedée — rien à recréer.');
  } else {
    const ANNEE = '2024-2025';
    const [school] = await db.insert(schema.schools).values({
      code:          'SCH-LEX-0001',
      nom:           'Lycée Excellence Brazzaville',
      adresse:       'Avenue de la Paix, Bacongo, Brazzaville',
      telephone:     '+242 06 500 00 00',
      anneeScolaire: ANNEE,
      accentColor:   '#0f766e',
    }).returning();

    await nationalReferentialService.provisionSchool(db, school.id, ['COLLEGE'], ANNEE, ['A', 'B']);
    console.log('🏫 Lycée Excellence Brazzaville provisionné (collège, 8 classes).');

    const admin = await createProfile({
      code: generateShortCode('ADM', 'Okemba', 'Paul'),
      nom: 'Okemba', prenom: 'Paul',
      email: DEMO_ADMIN, password: 'Admin@Demo2024!',
      phone: '+242065010001',
    });
    const adminM = await createMembership(admin.id, school.id, 'ADMIN', 'ADM', 'Okemba', 'Paul');

    const teacherDefs = [
      { nom: 'Mbemba', prenom: 'Claire', email: 'teacher@demo-school.edu', phone: '+242065010010' },
      { nom: 'Kaya',   prenom: 'Mathieu', email: 'teacher2@demo-school.edu', phone: '+242065010011' },
      { nom: 'Bouka',  prenom: 'Sylvie', email: 'teacher3@demo-school.edu', phone: '+242065010012' },
      { nom: 'Tsiba',  prenom: 'André', email: 'teacher4@demo-school.edu', phone: '+242065010013' },
    ];
    const teacherMs: Array<{ id: string; profileId: string }> = [];
    for (const t of teacherDefs) {
      const p = await createProfile({
        code: generateShortCode('TCH', t.nom, t.prenom),
        nom: t.nom, prenom: t.prenom, email: t.email, password: 'Teacher@Demo2024!', phone: t.phone,
      });
      const m = await createMembership(p.id, school.id, 'TEACHER', 'TCH', t.nom, t.prenom);
      teacherMs.push({ id: m.id, profileId: p.id });
    }
    const mainTeacher = teacherMs[0];

    const parent = await createProfile({
      code: generateShortCode('PAR', 'Nkodia', 'Marie'),
      nom: 'Nkodia', prenom: 'Marie',
      email: 'parent@demo-school.edu', password: 'Parent@Demo2024!',
      phone: '+242065010020',
    });
    const parentM = await createMembership(parent.id, school.id, 'PARENT', 'PAR', 'Nkodia', 'Marie');

    const classe4A = await db.query.classes.findFirst({
      where: and(eq(schema.classes.schoolId, school.id), eq(schema.classes.nom, '4ème A')),
    });
    if (!classe4A) throw new Error('Classe 4ème A introuvable après provision.');

    const schoolSubjects = await db.query.subjects.findMany({
      where: eq(schema.subjects.schoolId, school.id),
    });

    // Répartition des matières : l'enseignante principale (compte démo) en a le gros.
    const teacherBySubject = (nom: string) => {
      const n = nom.toLowerCase();
      if (n.includes('français') || n.includes('anglais') || n.includes('histoire') || n.includes('math')) return teacherMs[0];
      if (n.includes('physique')) return teacherMs[1];
      if (n.includes('vie') || n.includes('physique') || n.includes('sport') || n.includes('civique')) return teacherMs[2];
      return teacherMs[3];
    };

    const classSubjectRows: Array<{ id: string; teacherMembershipId: string }> = [];
    for (const sub of schoolSubjects) {
      const teacher = teacherBySubject(sub.nom);
      const [cs] = await db.insert(schema.classSubjects).values({
        classId:             classe4A.id,
        subjectId:           sub.id,
        teacherMembershipId: teacher.id,
        coefficient:         sub.nom.toLowerCase().includes('français') || sub.nom.toLowerCase().includes('math') ? '4' : '2',
        hoursPerWeek:        3,
      }).returning();
      classSubjectRows.push(cs);
    }
    console.log(`📘 ${classSubjectRows.length} matières assignées à 4ème A.`);

    const scheduleSlots = [
      { jour: 1, heureDebut: '07:30', heureFin: '08:30' },
      { jour: 1, heureDebut: '08:30', heureFin: '09:30' },
      { jour: 2, heureDebut: '07:30', heureFin: '08:30' },
      { jour: 3, heureDebut: '10:00', heureFin: '11:00' },
      { jour: 4, heureDebut: '07:30', heureFin: '08:30' },
    ];
    await db.insert(schema.schedules).values(
      scheduleSlots.map((slot, i) => ({
        classSubjectId: classSubjectRows[i % classSubjectRows.length].id,
        ...slot,
        salle: `Salle ${10 + i}`,
      }))
    );

    const studentDefs = [
      { nom: 'Nkodia',   prenom: 'Thomas',      email: 'student@demo-school.edu', sexe: 'M' as const, dob: '2011-03-14' },
      { nom: 'Massamba', prenom: 'Amina',       email: 'amina.massamba@demo-school.edu', sexe: 'F' as const, dob: '2011-07-02' },
      { nom: 'Mabiala',  prenom: 'Jean-Pierre', email: 'jp.mabiala@demo-school.edu', sexe: 'M' as const, dob: '2010-11-21' },
      { nom: 'Moukoko',  prenom: 'Grâce',       email: 'grace.moukoko@demo-school.edu', sexe: 'F' as const, dob: '2011-01-09' },
      { nom: 'Loubaki',  prenom: 'David',       email: 'david.loubaki@demo-school.edu', sexe: 'M' as const, dob: '2011-05-30' },
      { nom: 'Itoua',    prenom: 'Sarah',       email: 'sarah.itoua@demo-school.edu', sexe: 'F' as const, dob: '2010-09-18' },
    ];

    const createdStudents = [];
    for (let i = 0; i < studentDefs.length; i++) {
      const s = studentDefs[i];
      const pwd = s.email === 'student@demo-school.edu' ? 'Student@Demo2024!' : 'Student@Demo2024!';
      const p = await createProfile({
        code: generateShortCode('STU', s.nom, s.prenom),
        nom: s.nom, prenom: s.prenom, email: s.email, password: pwd,
      });
      const m = await createMembership(p.id, school.id, 'STUDENT', 'STU', s.nom, s.prenom);
      const [stu] = await db.insert(schema.students).values({
        membershipId:  m.id,
        classId:       classe4A.id,
        matricule:     generateMatricule(ANNEE, s.nom, s.prenom, i + 1),
        dateNaissance: s.dob,
        sexe:          s.sexe,
      }).returning();
      await paymentService.initializePayments(db, stu.id, ANNEE);
      createdStudents.push({ ...stu, membershipId: m.id, profileId: p.id, prenom: s.prenom });
    }

    await db.insert(schema.parentStudents).values({
      parentMembershipId: parentM.id,
      studentId:          createdStudents[0].id,
      lien:               'MERE',
    });

    // T1 soldé pour tous (bulletins déverrouillés) ; Thomas a un partiel en octobre scolaire mois 4.
    for (const stu of createdStudents) {
      for (const mois of [1, 2, 3]) {
        await paymentService.recordManualPayment(db, {
          studentId: stu.id, mois, anneeScolaire: ANNEE,
          montant: 25000, mode: 'ESPECES', agentId: adminM.id,
          observations: 'Règlement T1 (seed)',
        });
      }
    }
    await paymentService.recordManualPayment(db, {
      studentId: createdStudents[0].id, mois: 4, anneeScolaire: ANNEE,
      montant: 10000, mode: 'ESPECES', agentId: adminM.id,
      observations: 'Acompte (seed)',
    });

    const gradeValues = (i: number, j: number, k: number) =>
      Math.min(20, Math.max(6, 11 + ((i * 3 + j * 2 + k) % 9) - (i === 4 ? 4 : 0)));

    const gradeRows = [];
    for (let si = 0; si < createdStudents.length; si++) {
      for (let ci = 0; ci < classSubjectRows.length; ci++) {
        gradeRows.push({
          studentId: createdStudents[si].id,
          classSubjectId: classSubjectRows[ci].id,
          valeur: String(gradeValues(si, ci, 1)),
          typeEval: 'DEVOIR' as const,
          trimestre: 'T1' as const,
          enseignantId: classSubjectRows[ci].teacherMembershipId,
        });
        gradeRows.push({
          studentId: createdStudents[si].id,
          classSubjectId: classSubjectRows[ci].id,
          valeur: String(gradeValues(si, ci, 2)),
          typeEval: 'CONTROLE' as const,
          trimestre: 'T1' as const,
          enseignantId: classSubjectRows[ci].teacherMembershipId,
        });
        gradeRows.push({
          studentId: createdStudents[si].id,
          classSubjectId: classSubjectRows[ci].id,
          valeur: String(gradeValues(si, ci, 3)),
          typeEval: 'DEVOIR' as const,
          trimestre: 'T2' as const,
          enseignantId: classSubjectRows[ci].teacherMembershipId,
        });
      }
    }
    await db.insert(schema.grades).values(gradeRows);

    const dates = weekdayDates(5);
    const attCs = classSubjectRows[0];
    const attRows = [];
    for (const stu of createdStudents) {
      for (let di = 0; di < dates.length; di++) {
        const absent = stu.prenom === 'David' && di === 2;
        attRows.push({
          studentId:      stu.id,
          classSubjectId: attCs.id,
          date:           dates[di],
          statut:         (absent ? 'ABSENT' : 'PRESENT') as 'ABSENT' | 'PRESENT',
          motif:          absent ? 'Maladie' : null,
          markedById:     mainTeacher.id,
        });
      }
    }
    await db.insert(schema.attendances).values(attRows);

    const bulletinResult = await bulletinService.generateForClass(db, classe4A.id, 'T1', ANNEE);
    if (bulletinResult.studentIds.length > 0) {
      await db.update(schema.bulletins)
        .set({ statut: 'PUBLIE', generatedAt: new Date() })
        .where(and(
          eq(schema.bulletins.trimestre, 'T1'),
          inArray(schema.bulletins.studentId, bulletinResult.studentIds),
        ));
    }
    console.log(`📄 Bulletins T1 générés : ${bulletinResult.generated}`);

    await db.insert(schema.messages).values([
      { schoolId: school.id, senderId: parentM.id, receiverId: adminM.id, sujet: 'Retard de paiement', contenu: 'Bonjour, je réglerai le solde de Thomas en fin de semaine.' },
      { schoolId: school.id, senderId: adminM.id, receiverId: parentM.id, sujet: 'Re: Retard de paiement', contenu: 'Bien reçu Madame Nkodia. Un reçu vous sera remis au guichet.' },
      { schoolId: school.id, senderId: mainTeacher.id, receiverId: parentM.id, sujet: 'Progression de Thomas', contenu: 'Thomas progresse bien en français. Encouragez la lecture à la maison.' },
      { schoolId: school.id, senderId: parentM.id, receiverId: mainTeacher.id, sujet: 'Re: Progression de Thomas', contenu: 'Merci maîtresse, nous allons suivre vos conseils.' },
      { schoolId: school.id, senderId: adminM.id, receiverId: mainTeacher.id, sujet: 'Conseil de classe T1', contenu: 'Conseil de classe mercredi 15h, salle des profs.' },
      { schoolId: school.id, senderId: mainTeacher.id, receiverId: adminM.id, sujet: 'Re: Conseil de classe T1', contenu: 'Je serai présente. J’apporte les moyennes de 4ème A.' },
    ]);

    await db.insert(schema.notifications).values([
      { profileId: parent.id, schoolId: school.id, titre: 'Bulletin T1 publié', message: 'Le bulletin du 1er trimestre de Thomas est disponible.', type: 'BULLETIN' },
      { profileId: parent.id, schoolId: school.id, titre: 'Rappel de scolarité', message: 'Un solde reste dû pour le mois 4.', type: 'PAIEMENT' },
      { profileId: admin.id, schoolId: school.id, titre: 'Nouveau message', message: 'Marie Nkodia vous a écrit.', type: 'MESSAGE' },
      { profileId: teacherMs[0].profileId, schoolId: school.id, titre: 'Conseil de classe', message: 'Mercredi 15h, salle des profs.', type: 'ANNONCE' },
      { profileId: createdStudents[0].profileId, schoolId: school.id, titre: 'Bienvenue', message: 'Votre espace élève est prêt.', type: 'SYSTEME' },
    ]);

    await db.insert(schema.announcements).values([
      { schoolId: school.id, auteurId: adminM.id, titre: 'Rentrée 2024-2025', contenu: 'Bienvenue à tous. Les cours reprennent lundi 8h.', cible: 'ALL' },
      { schoolId: school.id, auteurId: adminM.id, titre: 'Réunion parents', contenu: 'Réunion des parents de 4ème A vendredi 16h.', cible: 'PARENTS' },
      { schoolId: school.id, auteurId: adminM.id, titre: 'Saisie des notes T1', contenu: 'Merci de finaliser la saisie des notes avant vendredi.', cible: 'TEACHERS' },
    ]);

    console.log('✅ Données de démonstration créées.');
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║               🎓 SEED TERMINÉ — Lycée Excellence Brazzaville        ║
╠══════════════════════════════════════════════════════════════════════╣
║  Super Admin   superadmin@sulungukutu.com    SuperAdmin@2024!         ║
║  Admin         admin@demo-school.edu        Admin@Demo2024!          ║
║  Enseignante   teacher@demo-school.edu      Teacher@Demo2024!        ║
║  Parent        parent@demo-school.edu       Parent@Demo2024!         ║
║  Élève (Thomas)student@demo-school.edu      Student@Demo2024!        ║
╠══════════════════════════════════════════════════════════════════════╣
║  4 niveaux · 8 classes · matières collège · 6 élèves en 4ème A      ║
║  Notes T1/T2 · Bulletins T1 publiés · Messages · Notifs · Paiements  ║
╚══════════════════════════════════════════════════════════════════════╝
  `);

  await client.end();
}

seed().catch((err) => {
  console.error('❌ Erreur seed :', err);
  process.exit(1);
});
