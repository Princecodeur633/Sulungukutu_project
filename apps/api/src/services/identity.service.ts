import { eq } from 'drizzle-orm';
import { globalProfiles, schoolMemberships } from '../db/schema';
import { generateShortCode, roleToPrefixCode } from '../utils/code-generator';
import { auditService } from './audit.service';
import type { DB } from '../db';

// ============================================================
// IDENTITY SERVICE
// ------------------------------------------------------------
// Point d'entrée UNIQUE pour la génération d'identifiants de connexion et
// d'emails internes lors de la création de tout utilisateur (élève,
// enseignant, parent, admin). Les resolvers ne doivent plus bricoler leur
// propre génération de code/email — ils appellent `identityService.createIdentity`.
//
// Garanties :
//  - unicité de l'identifiant de connexion (school_memberships.code)
//  - unicité de l'email interne généré (global_profiles.email), avec
//    résolution automatique des conflits de nom/prénom identiques
//  - traçabilité complète via le journal d'audit (IDENTITY_GENERATED /
//    IDENTITY_CONFLICT_RESOLVED)
//  - isolation multi-tenant : l'email interne intègre le code de l'école,
//    donc deux établissements ne peuvent jamais entrer en collision entre eux
// ============================================================

const MAX_ATTEMPTS = 10;

function slugify(value: string): string {
  return value
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase() || 'x';
}

export const identityService = {
  /**
   * Génère un identifiant de connexion unique (school_memberships.code)
   * pour un rôle donné. Retente en cas de collision improbable plutôt que
   * de laisser remonter une erreur de contrainte UNIQUE brute au client.
   */
  generateUniqueLoginCode: async (
    db: DB,
    role: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT',
    nom: string,
    prenom?: string
  ): Promise<string> => {
    const prefix = roleToPrefixCode(role);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = generateShortCode(prefix, nom, prenom);
      const conflict = await db.query.schoolMemberships.findFirst({
        where: eq(schoolMemberships.code, candidate),
      });
      if (!conflict) return candidate;
    }
    // Extrêmement improbable (10 collisions hex de suite) — code de secours
    // avec un suffixe temporel pour garantir l'unicité à coup sûr.
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  },

  /**
   * Réutilise un code déjà attribué au profil s'il n'est pas pris
   * comme identifiant de membership — évite d'avoir deux codes
   * différents (profil vs membership) pour la même personne.
   */
  reuseOrGenerateLoginCode: async (
    db: DB,
    role: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT',
    nom: string,
    prenom: string,
    preferredCode?: string | null
  ): Promise<string> => {
    if (preferredCode) {
      const conflict = await db.query.schoolMemberships.findFirst({
        where: eq(schoolMemberships.code, preferredCode),
      });
      if (!conflict) return preferredCode;
    }
    return identityService.generateUniqueLoginCode(db, role, nom, prenom);
  },

  /**
   * Génère un email interne normalisé et garanti unique, au format
   * prenom.nom@{codeEcole}.sulungukutu.local. En cas de conflit (même
   * prénom+nom dans la même école), ajoute un suffixe numérique croissant :
   * prenom.nom2@..., prenom.nom3@..., etc.
   */
  generateUniqueInternalEmail: async (
    db: DB,
    nom: string,
    prenom: string,
    schoolCode: string
  ): Promise<{ email: string; hadConflict: boolean }> => {
    const domain = `${slugify(schoolCode)}.sulungukutu.local`;
    const base = `${slugify(prenom)}.${slugify(nom)}`;

    let suffix = 0;
    let hadConflict = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const local = suffix === 0 ? base : `${base}${suffix + 1}`;
      const candidate = `${local}@${domain}`;
      const conflict = await db.query.globalProfiles.findFirst({
        where: eq(globalProfiles.email, candidate),
      });
      if (!conflict) return { email: candidate, hadConflict };
      hadConflict = true;
      suffix++;
    }
    // Filet de sécurité ultime : suffixe temporel garanti unique.
    return { email: `${base}${Date.now()}@${domain}`, hadConflict: true };
  },

  /**
   * Orchestration complète : génère code + email, journalise l'opération.
   * `email` peut être fourni explicitement (ex: email personnel réel donné
   * par l'admin) — dans ce cas l'email n'est PAS régénéré, seul le code de
   * connexion l'est. Sans email fourni, un email interne est généré.
   */
  createIdentity: async (
    db: DB,
    input: {
      role: 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
      nom: string;
      prenom: string;
      schoolId: string | null;
      schoolCode: string;
      explicitEmail?: string | null;
      actorMembershipId?: string | null;
    }
  ): Promise<{ code: string; email: string }> => {
    const code = await identityService.generateUniqueLoginCode(db, input.role, input.nom, input.prenom);

    let email = input.explicitEmail ?? null;
    let hadConflict = false;
    if (!email) {
      const generated = await identityService.generateUniqueInternalEmail(
        db, input.nom, input.prenom, input.schoolCode
      );
      email = generated.email;
      hadConflict = generated.hadConflict;
    }

    await auditService.log(db, {
      schoolId:   input.schoolId,
      actorId:    input.actorMembershipId,
      action:     'IDENTITY_GENERATED',
      entityType: 'identity',
      entityId:   code,
      newValue:   { code, email, role: input.role, emailGenerated: !input.explicitEmail },
      description: `Identifiant "${code}" ${!input.explicitEmail ? `et email interne "${email}" ` : ''}générés pour ${input.prenom} ${input.nom} (${input.role})`,
    });

    if (hadConflict) {
      await auditService.log(db, {
        schoolId:   input.schoolId,
        actorId:    input.actorMembershipId,
        action:     'IDENTITY_CONFLICT_RESOLVED',
        entityType: 'identity',
        entityId:   code,
        newValue:   { email },
        description: `Conflit de nom/prénom détecté pour ${input.prenom} ${input.nom} — email "${email}" attribué après résolution automatique`,
      });
    }

    return { code, email };
  },
};
