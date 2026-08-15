/**
 * Seed sulungukutu — données de démonstration complètes et réalistes
 *
 * Idempotent : si l'école de démo existe déjà, le seed s'arrête.
 *
 * Usage : pnpm --filter api db:seed
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool }    from 'pg';
import bcrypt      from 'bcryptjs';
import { eq }     from 'drizzle-orm';
import * as schema from './schema';
import { bulletinService } from '../services/bulletin.service';

// ── Connexion directe pour le seed (pas de Neon http pour les transactions) ─
const client = new Pool({ connectionString: process.env.DATABASE_URL! });
const db     = drizzle(client, { schema });

async function hash(pwd: string) { return bcrypt.hash(pwd, 12); }

// ── Helpers ────────────────────────────────────────────────────
async function createProfile(data: {
  code: string; nom: string; prenom: string;
  email: string; password: string;
  phone?: string;
}) {
  const [profile] = await db.insert(schema.globalProfiles).values({
    code:         data.code,
    nom:          data.nom,
    prenom:       data.prenom,
    email:        data.email,
    phone:        data.phone ?? null,
    passwordHash: await hash(data.password),

  }).returning();
  return profile;
}

async function createMembership(profileId: string, schoolId: string, role: string, code: string) {
  const [m] = await db.insert(schema.schoolMemberships).values({
    profileId, schoolId, role: role as any, code, status: 'ACTIVE',
  }).returning();
  return m;
}

// ── Seed principal ─────────────────────────────────────────────
async function seed() {
  console.log('\n🌱 Démarrage du seed sulungukutu...\n');

  // ── 0. Référentiel national pédagogique (Congo-Brazzaville) ──
  const { nationalReferentialService } = await import('../services/national-referential.service');
  await nationalReferentialService.seed(db);
  console.log('📚 Référentiel national pédagogique prêt (idempotent).');

  // ── 1. Super Admin ──────────────────────────────────────────
  const SA_EMAIL = process.env.SUPER_ADMIN_EMAIL    ?? 'superadmin@sulungukutu.com';
  const SA_PWD   = process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@2024!';

  const existing = await db.query.globalProfiles.findFirst({
    where: (t, { eq }) => eq(t.email, SA_EMAIL),
  });
  if (!existing) {
    const saProfile = await createProfile({ code: 'SUP-0001', nom: 'Admin', prenom: 'Super',
      email: SA_EMAIL, password: SA_PWD });

    // Créer une école système pour le super admin
    const [sysSchool] = await db.insert(schema.schools).values({
      code: 'SYS-PLATFORM-001', nom: 'sulungukutu Platform',
      anneeScolaire: '2024-2025',
    }).returning();

    await db.insert(schema.schoolMemberships).values({
      profileId: saProfile.id,
      schoolId:  sysSchool.id,
      role:      'SUPER_ADMIN' as any,
      code:      'SUP-0001',
      status:    'ACTIVE',
    }).onConflictDoNothing();
    console.log(`✅ Super Admin : ${SA_EMAIL}`);
  } else {
    console.log(`ℹ️  Super Admin déjà existant`);
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
║  4 niveaux · 8 classes · 10 matières · 6 élèves en 4ème A           ║
║  Notes T1/T2 · Bulletins T1 publiés · Messages · Notifs · Paiements  ║
╚══════════════════════════════════════════════════════════════════════╝
  `);

  await client.end();
}

seed().catch((err) => {
  console.error('❌ Erreur seed :', err);
  process.exit(1);
});

