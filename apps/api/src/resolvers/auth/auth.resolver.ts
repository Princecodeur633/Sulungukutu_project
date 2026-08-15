import { generateTempPassword } from '../../utils/password';
import { normalizePhone } from '../../utils/phone';
import bcrypt from 'bcryptjs';
import { and, eq, or, sql } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { globalProfiles, schoolMemberships } from '../../db/schema';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';
import { requireAuth, requireSchoolAdmin } from '../../middleware/permissions';
import { LoginSchema, ChangePasswordSchema } from '../../utils/validators/schemas';
import type { GraphQLContext } from '../../middleware/auth';
import { emailService } from '../../services/email.service';
import { enforcLoginRateLimit, getClientIp } from '../../middleware/rate-limit';

// ── Utilitaires locaux ────────────────────────────────────────────

export const authResolvers = {
  Query: {
    // Profil courant
    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const profile = await ctx.db.query.globalProfiles.findFirst({
        where: eq(globalProfiles.id, user.profileId),
        with: { memberships: { with: { school: true } } },
      });
      if (!profile) throw new GraphQLError('Profil introuvable');
      return profile;
    },

    // Tous les workspaces de l'utilisateur
    myMemberships: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      return ctx.db.query.schoolMemberships.findMany({
        where: eq(schoolMemberships.profileId, user.profileId),
        with: { school: true, studentProfile: true },
      });
    },

    // Membership courant dans une école
    myCurrentMembership: async (
      _: unknown,
      args: { schoolId: string },
      ctx: GraphQLContext
    ) => {
      const user = requireAuth(ctx);
      return ctx.db.query.schoolMemberships.findFirst({
        where: and(
          eq(schoolMemberships.profileId, user.profileId),
          eq(schoolMemberships.schoolId, args.schoolId)
        ),
        with: { school: true },
      });
    },
  },

  Mutation: {
    // Connexion
    login: async (
      _: unknown,
      args: { input: { identifiant: string; password: string } },
      ctx: GraphQLContext
    ) => {
      // Brute-force protection : 10 tentatives / 5 min par IP
      enforcLoginRateLimit(getClientIp(ctx.request as any));
      const input = LoginSchema.parse(args.input);

      // Avant : la connexion n'était possible que par email exact. Beaucoup
      // d'utilisateurs (parents, élèves) n'ont pas d'adresse email
      // personnelle et ne mémorisent pas l'email interne généré
      // automatiquement (prenom.nom@ecole.sulungukutu.local). On accepte
      // désormais aussi l'identifiant de connexion (matricule, ex:
      // STU-A1B2, distribué sur le reçu d'inscription) ou le téléphone.
      const raw = input.identifiant.trim();
      const normalizedPhone = normalizePhone(raw);
      const profile = await ctx.db.query.globalProfiles.findFirst({
        where: or(
          eq(globalProfiles.email, raw.toLowerCase()),
          eq(globalProfiles.code,  raw.toUpperCase()),
          eq(globalProfiles.phone, raw),
          // Comparaison normalisée : ignore espaces/tirets/préfixe +242,
          // pour qu'un numéro tapé sous n'importe quel format courant
          // corresponde à ce qui a été enregistré.
          normalizedPhone.length >= 8
            ? sql`regexp_replace(${globalProfiles.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedPhone.slice(-8)}`
            : undefined,
        ),
      });

      if (!profile) {
        throw new GraphQLError('Identifiant ou mot de passe incorrect', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const isValid = await bcrypt.compare(input.password, profile.passwordHash);
      if (!isValid) {
        throw new GraphQLError('Identifiant ou mot de passe incorrect', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Récupère tous les workspaces actifs
      const memberships = await ctx.db.query.schoolMemberships.findMany({
        where: and(
          eq(schoolMemberships.profileId, profile.id),
          eq(schoolMemberships.status, 'ACTIVE')
        ),
        with: { school: true },
      });

      // NOTE: le rôle SUPER_ADMIN doit venir du profil (`profile.isSuperAdmin`),
      // pas uniquement d'un membership d'école. Avant ce correctif, un compte
      // Super-Admin sans membership actif (ou dont l'unique membership était
      // désactivé) se voyait attribuer le rôle "STUDENT" par défaut et perdait
      // tout accès aux fonctionnalités Super-Admin après connexion.
      const role = profile.isSuperAdmin ? 'SUPER_ADMIN' : (memberships[0]?.role ?? 'STUDENT');

      const accessToken = signAccessToken({
        profileId: profile.id,
        email:     profile.email,
        role,
        schoolId:  memberships[0]?.schoolId,
        membershipId: memberships[0]?.id,
      });

      const refreshToken = signRefreshToken({ profileId: profile.id });

      return {
        accessToken,
        refreshToken,
        profile,
        currentMembership:       memberships[0] ?? null,
        availableMemberships:    memberships,
      };
    },

    // Déconnexion (stateless JWT — côté client on supprime le token)
    logout: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx);
      return true;
    },

    // Refresh du token
    refreshToken: async (
      _: unknown,
      args: { token: string },
      ctx: GraphQLContext
    ) => {
      let decoded;
      try {
        decoded = verifyRefreshToken(args.token);
      } catch {
        throw new GraphQLError('Refresh token invalide ou expiré', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const profile = await ctx.db.query.globalProfiles.findFirst({
        where: eq(globalProfiles.id, decoded.profileId),
      });
      if (!profile) throw new GraphQLError('Profil introuvable');

      const memberships = await ctx.db.query.schoolMemberships.findMany({
        where: and(
          eq(schoolMemberships.profileId, profile.id),
          eq(schoolMemberships.status, 'ACTIVE')
        ),
        with:  { school: true },
      });

      const role = profile.isSuperAdmin ? 'SUPER_ADMIN' : (memberships[0]?.role ?? 'STUDENT');

      const accessToken  = signAccessToken({
        profileId: profile.id,
        email:     profile.email,
        role,
        schoolId:  memberships[0]?.schoolId,
        membershipId: memberships[0]?.id,
      });
      const refreshToken = signRefreshToken({ profileId: profile.id });

      return {
        accessToken,
        refreshToken,
        profile,
        currentMembership:    memberships[0] ?? null,
        availableMemberships: memberships,
      };
    },

    // Switch workspace (passe d'une école à une autre)
    switchWorkspace: async (
      _: unknown,
      args: { schoolId: string },
      ctx: GraphQLContext
    ) => {
      const user = requireAuth(ctx);

      const membership = await ctx.db.query.schoolMemberships.findFirst({
        where: and(
          eq(schoolMemberships.profileId, user.profileId),
          eq(schoolMemberships.schoolId, args.schoolId),
          eq(schoolMemberships.status, 'ACTIVE')
        ),
        with: { school: true },
      });

      if (!membership) {
        throw new GraphQLError(
          "Vous n'avez pas accès à cet établissement.",
          { extensions: { code: 'FORBIDDEN' } }
        );
      }

      const profile = await ctx.db.query.globalProfiles.findFirst({
        where: eq(globalProfiles.id, user.profileId),
      });
      if (!profile) throw new GraphQLError('Profil introuvable');

      const accessToken = signAccessToken({
        profileId:    profile.id,
        email:        profile.email,
        role:         membership.role,
        schoolId:     membership.schoolId,
        membershipId: membership.id,
      });

      return { accessToken, membership };
    },

    // Changement de mot de passe

    uploadAvatar: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx);
      // Avatar upload requires file storage integration (S3/Cloudflare R2)
      // Returning current profile without change as a stub
      return ctx.db.query.globalProfiles.findFirst({
        where: eq(globalProfiles.id, ctx.currentUser!.profileId),
      });
    },

    changePassword: async (
      _: unknown,
      args: { input: { oldPassword: string; newPassword: string } },
      ctx: GraphQLContext
    ) => {
      const user  = requireAuth(ctx);
      const input = ChangePasswordSchema.parse(args.input);

      const profile = await ctx.db.query.globalProfiles.findFirst({
        where: eq(globalProfiles.id, user.profileId),
      });
      if (!profile) throw new GraphQLError('Profil introuvable');

      const isValid = await bcrypt.compare(input.oldPassword, profile.passwordHash);
      if (!isValid) {
        throw new GraphQLError('Ancien mot de passe incorrect');
      }

      const newHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db
        .update(globalProfiles)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(globalProfiles.id, profile.id));

      return true;
    },

    // Auparavant appelée par le frontend mais INEXISTANTE côté backend —
    // le formulaire "mot de passe oublié" ne fonctionnait donc pas du tout.
    requestPasswordReset: async (
      _: unknown,
      args: { identifiant: string },
      ctx: GraphQLContext
    ) => {
      enforcLoginRateLimit(getClientIp(ctx.request as any));
      const raw = args.identifiant.trim();
      const normalizedPhone = normalizePhone(raw);

      const profile = await ctx.db.query.globalProfiles.findFirst({
        where: or(
          eq(globalProfiles.email, raw.toLowerCase()),
          eq(globalProfiles.code,  raw.toUpperCase()),
          eq(globalProfiles.phone, raw),
          normalizedPhone.length >= 8
            ? sql`regexp_replace(${globalProfiles.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedPhone.slice(-8)}`
            : undefined,
        ),
      });

      // Toujours renvoyer true (même si le compte n'existe pas) : on ne
      // révèle jamais si un identifiant est enregistré ou non.
      if (!profile) return true;

      const newPassword = generateTempPassword();
      const newHash     = await bcrypt.hash(newPassword, 12);
      await ctx.db
        .update(globalProfiles)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(globalProfiles.id, profile.id));

      // L'email interne généré automatiquement (…@ecole.sulungukutu.local)
      // n'est jamais une vraie boîte mail — inutile d'essayer de l'envoyer.
      // Dans ce cas, seul un admin de l'établissement peut communiquer le
      // nouveau mot de passe (voir adminResetPassword ci-dessous).
      const hasRealEmail = !profile.email.endsWith('.sulungukutu.local');
      if (hasRealEmail) {
        await emailService.sendPasswordReset({
          to: profile.email, prenom: profile.prenom, newPassword,
        }).catch(() => {});
      }

      return true;
    },

    // Réinitialisation en présentiel par un admin — le seul canal fiable
    // pour un utilisateur sans email personnel (cas fréquent : parents,
    // élèves). Le nouveau mot de passe est renvoyé directement à l'admin,
    // à remettre en main propre, exactement comme à la création du compte.
    adminResetPassword: async (
      _: unknown,
      args: { membershipId: string },
      ctx: GraphQLContext
    ) => {
      const membership = await ctx.db.query.schoolMemberships.findFirst({
        where: eq(schoolMemberships.id, args.membershipId),
        with: { profile: true },
      });
      if (!membership) {
        throw new GraphQLError('Membre introuvable', { extensions: { code: 'NOT_FOUND' } });
      }
      requireSchoolAdmin(ctx, membership.schoolId);

      const newPassword = generateTempPassword();
      const newHash     = await bcrypt.hash(newPassword, 12);
      await ctx.db
        .update(globalProfiles)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(globalProfiles.id, membership.profileId));

      const hasRealEmail = !membership.profile.email.endsWith('.sulungukutu.local');
      if (hasRealEmail) {
        await emailService.sendPasswordReset({
          to: membership.profile.email, prenom: membership.profile.prenom, newPassword,
        }).catch(() => {});
      }

      return { tempPassword: newPassword, hasRealEmail };
    },

    // Mise à jour du profil
    updateProfile: async (
      _: unknown,
      args: { input: { nom?: string; prenom?: string; email?: string; phone?: string; avatarUrl?: string } },
      ctx: GraphQLContext
    ) => {
      const user = requireAuth(ctx);
      const [updated] = await ctx.db
        .update(globalProfiles)
        .set({ ...args.input, updatedAt: new Date() })
        .where(eq(globalProfiles.id, user.profileId))
        .returning();
      return updated;
    },
  },
};
