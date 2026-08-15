import { eq, and, or, count, isNull } from 'drizzle-orm';
import { announcements, auditLogs, messages, notifications, schoolMemberships } from '../../db/schema';
import { requireAuth, requireAdmin, requireSchoolMember, requireSchoolAdmin } from '../../middleware/permissions';
import { SendMessageSchema, CreateAnnouncementSchema } from '../../utils/validators/schemas';
import { pubsub }       from '../../pubsub';
import { auditService } from '../../services/audit.service';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../../middleware/auth';

// ── Messages ──────────────────────────────────────────────────
export const messageResolvers = {
  Query: {
    myMessages: async (
      _: unknown,
      args: { schoolId: string; pagination?: { page: number; limit: number } },
      ctx: GraphQLContext
    ) => {
      const user   = requireSchoolMember(ctx, args.schoolId);
      const page   = args.pagination?.page  ?? 1;
      const limit  = args.pagination?.limit ?? 20;
      const offset = (page - 1) * limit;

      const data = await ctx.db.query.messages.findMany({
        where: or(
          eq(messages.senderId,   user.membershipId!),
          eq(messages.receiverId, user.membershipId!),
        ),
        limit,
        offset,
        orderBy: (m, { desc }) => [desc(m.createdAt)],
        with: {
          sender:   { with: { profile: true } },
          receiver: { with: { profile: true } },
        },
      });

      return {
        data,
        pageInfo: {
          hasNextPage:     data.length === limit,
          hasPreviousPage: page > 1,
          totalCount:      data.length,
          currentPage:     page,
          totalPages:      Math.ceil(data.length / limit),
        },
      };
    },

    conversation: async (
      _: unknown,
      args: { schoolId: string; withMembershipId: string; pagination?: { page: number; limit: number } },
      ctx: GraphQLContext
    ) => {
      const user   = requireSchoolMember(ctx, args.schoolId);
      const page   = args.pagination?.page  ?? 1;
      const limit  = args.pagination?.limit ?? 30;
      const offset = (page - 1) * limit;

      const data = await ctx.db.query.messages.findMany({
        where: or(
          and(eq(messages.senderId, user.membershipId!), eq(messages.receiverId, args.withMembershipId)),
          and(eq(messages.senderId, args.withMembershipId), eq(messages.receiverId, user.membershipId!)),
        ),
        limit,
        offset,
        orderBy: (m, { asc }) => [asc(m.createdAt)],
        with: {
          sender:   { with: { profile: true } },
          receiver: { with: { profile: true } },
        },
      });

      return {
        data,
        pageInfo: {
          hasNextPage:     data.length === limit,
          hasPreviousPage: page > 1,
          totalCount:      data.length,
          currentPage:     page,
          totalPages:      Math.ceil(data.length / limit),
        },
      };
    },

    unreadMessageCount: async (
      _: unknown,
      args: { schoolId: string },
      ctx: GraphQLContext
    ) => {
      const user = requireSchoolMember(ctx, args.schoolId);
      const [result] = await ctx.db
        .select({ count: count() })
        .from(messages)
        .where(and(
          eq(messages.receiverId, user.membershipId!),
          eq(messages.lu, false),
        ));
      return Number(result.count);
    },
  },

  Mutation: {
    sendMessage: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const user  = requireSchoolMember(ctx, args.input.schoolId as string);
      const input = SendMessageSchema.parse(args.input);

      const [msg] = await ctx.db
        .insert(messages)
        .values({
          schoolId:   input.schoolId,
          senderId:   user.membershipId!,
          receiverId: input.receiverId,
          sujet:      input.sujet,
          contenu:    input.contenu,
        })
        .returning();

      // Notification au destinataire
      const receiver = await ctx.db.query.schoolMemberships.findFirst({
        where: eq(schoolMemberships.id, input.receiverId),
        with:  { profile: true },
      });
      if (receiver) {
        const [msgNotif] = await ctx.db.insert(notifications).values({
          profileId: (receiver as any).profile.id,
          schoolId:  input.schoolId,
          titre:     `✉️ Nouveau message`,
          message:   `Vous avez reçu un nouveau message : "${input.sujet}"`,
          type:      'MESSAGE',
        }).returning();
        // Notifier en temps réel
        if (msgNotif) {
          pubsub.publish('NOTIFICATION_ADDED', msgNotif.profileId, {
            notificationAdded: msgNotif,
          });
        }
      }

      // Notifier le destinataire via subscription
      pubsub.publish('MESSAGE_RECEIVED', args.input.schoolId as string, {
        messageReceived: msg,
      });

      return msg;
    },

    markMessageAsRead: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      // Avant : requireAuth(ctx) seul — n'importe quel utilisateur connecté
      // pouvait marquer comme lu un message adressé à quelqu'un d'autre.
      const msg = await ctx.db.query.messages.findFirst({ where: eq(messages.id, args.id) });
      if (!msg) throw new GraphQLError('Message introuvable', { extensions: { code: 'NOT_FOUND' } });
      if (msg.receiverId !== user.membershipId) {
        throw new GraphQLError('Accès refusé — permissions insuffisantes.', { extensions: { code: 'FORBIDDEN' } });
      }
      const [updated] = await ctx.db
        .update(messages).set({ lu: true }).where(eq(messages.id, args.id)).returning();
      return updated;
    },

    markAllMessagesAsRead: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      const user = requireSchoolMember(ctx, args.schoolId);
      await ctx.db
        .update(messages)
        .set({ lu: true })
        .where(and(eq(messages.receiverId, user.membershipId!), eq(messages.lu, false)));
      return true;
    },

    deleteMessage: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      // Avant : requireAuth(ctx) seul + DELETE physique — n'importe quel
      // utilisateur connecté pouvait supprimer N'IMPORTE QUEL message de
      // N'IMPORTE QUI, même d'une autre école, juste en devinant son ID.
      const msg = await ctx.db.query.messages.findFirst({ where: eq(messages.id, args.id) });
      if (!msg) throw new GraphQLError('Message introuvable', { extensions: { code: 'NOT_FOUND' } });
      if (msg.senderId !== user.membershipId && user.role !== 'SUPER_ADMIN') {
        throw new GraphQLError('Accès refusé — permissions insuffisantes.', { extensions: { code: 'FORBIDDEN' } });
      }
      await ctx.db.delete(messages).where(eq(messages.id, args.id));
      return true;
    },
  },
};

// ── Notifications ─────────────────────────────────────────────
export const notificationResolvers = {
  Query: {
    myNotifications: async (
      _: unknown,
      args: { pagination?: { page: number; limit: number } },
      ctx: GraphQLContext
    ) => {
      const user   = requireAuth(ctx);
      const page   = args.pagination?.page  ?? 1;
      const limit  = args.pagination?.limit ?? 20;
      const offset = (page - 1) * limit;

      const data = await ctx.db.query.notifications.findMany({
        where:   eq(notifications.profileId, user.profileId),
        limit,
        offset,
        orderBy: (n, { desc }) => [desc(n.createdAt)],
        with: { school: true },
      });

      return {
        data,
        pageInfo: {
          hasNextPage:     data.length === limit,
          hasPreviousPage: page > 1,
          totalCount:      data.length,
          currentPage:     page,
          totalPages:      Math.ceil(data.length / limit),
        },
      };
    },

    unreadNotificationCount: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      const [result] = await ctx.db
        .select({ count: count() })
        .from(notifications)
        .where(and(
          eq(notifications.profileId, user.profileId),
          eq(notifications.lu, false),
        ));
      return Number(result.count);
    },
  },

  Mutation: {
    markNotificationAsRead: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx);
      const [updated] = await ctx.db
        .update(notifications).set({ lu: true }).where(eq(notifications.id, args.id)).returning();
      return updated;
    },

    markAllNotificationsAsRead: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      await ctx.db
        .update(notifications)
        .set({ lu: true })
        .where(and(eq(notifications.profileId, user.profileId), eq(notifications.lu, false)));
      return true;
    },

    deleteNotification: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const user = requireAuth(ctx);
      // Avant : requireAuth(ctx) seul + DELETE physique — n'importe quel
      // utilisateur pouvait supprimer la notification de quelqu'un d'autre.
      const notif = await ctx.db.query.notifications.findFirst({ where: eq(notifications.id, args.id) });
      if (!notif) throw new GraphQLError('Notification introuvable', { extensions: { code: 'NOT_FOUND' } });
      if (notif.profileId !== user.profileId) {
        throw new GraphQLError('Accès refusé — permissions insuffisantes.', { extensions: { code: 'FORBIDDEN' } });
      }
      await ctx.db.delete(notifications).where(eq(notifications.id, args.id));
      return true;
    },
  },
};

// ── Annonces ──────────────────────────────────────────────────
export const announcementResolvers = {
  Query: {
    announcementsBySchool: async (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
      requireSchoolMember(ctx, args.schoolId);
      return ctx.db.query.announcements.findMany({
        where:   and(eq(announcements.schoolId, args.schoolId), isNull(announcements.deletedAt)),
        orderBy: (a, { desc }) => [desc(a.createdAt)],
        with: { auteur: { with: { profile: true } } },
      });
    },

    announcementById: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const announcement = await ctx.db.query.announcements.findFirst({ where: eq(announcements.id, args.id) });
      if (!announcement) throw new GraphQLError('Annonce introuvable', { extensions: { code: 'NOT_FOUND' } });
      // Avant : requireAuth(ctx) seul — n'importe quel utilisateur pouvait
      // lire les annonces internes de n'importe quelle autre école.
      requireSchoolMember(ctx, announcement.schoolId);
      return ctx.db.query.announcements.findFirst({
        where: eq(announcements.id, args.id),
        with:  { auteur: { with: { profile: true } } },
      });
    },
  },

  Mutation: {
    createAnnouncement: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      const targetSchoolId = String(args.input.schoolId ?? '');
      const user  = requireSchoolAdmin(ctx, targetSchoolId);
      const input = CreateAnnouncementSchema.parse(args.input);

      const [created] = await ctx.db
        .insert(announcements)
        .values({ ...input, auteurId: user.membershipId! })
        .returning();

      await auditService.log(ctx.db, {
        schoolId:    targetSchoolId,
        actorId:     user.membershipId,
        action:      'ANNOUNCEMENT_CREATED',
        entityType:  'announcement',
        entityId:    created.id,
        description: `Annonce : "${input.titre}" → ${input.cible}`,
      });

      // Publier l'annonce via subscription
      pubsub.publish('ANNOUNCEMENT_PUBLISHED', targetSchoolId, {
        announcementPublished: created,
      });

      return created;
    },

    updateAnnouncement: async (
      _: unknown,
      args: { id: string; input: Record<string, unknown> },
      ctx: GraphQLContext
    ) => {
      // NOTE: auparavant aucune vérification d'appartenance à l'école —
      // n'importe quel ADMIN pouvait modifier l'annonce de n'importe quelle
      // école. On la retrouve désormais avant d'autoriser l'action.
      const existing = await ctx.db.query.announcements.findFirst({ where: eq(announcements.id, args.id) });
      if (!existing) throw new GraphQLError('Annonce introuvable', { extensions: { code: 'NOT_FOUND' } });
      requireSchoolAdmin(ctx, existing.schoolId);

      const input = CreateAnnouncementSchema.parse(args.input);
      const [updated] = await ctx.db
        .update(announcements)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(announcements.id, args.id))
        .returning();
      return updated;
    },

    deleteAnnouncement: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const existing = await ctx.db.query.announcements.findFirst({ where: eq(announcements.id, args.id) });
      if (!existing) throw new GraphQLError('Annonce introuvable', { extensions: { code: 'NOT_FOUND' } });
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      // Avant : DELETE physique. Corrigé : soft delete, restaurable.
      await ctx.db
        .update(announcements)
        .set({ deletedAt: new Date() })
        .where(eq(announcements.id, args.id));
      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'ANNOUNCEMENT_DELETED',
        entityType:  'announcement',
        entityId:    args.id,
        description: 'Annonce désactivée (soft delete)',
      });
      return true;
    },

    restoreAnnouncement: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const existing = await ctx.db.query.announcements.findFirst({ where: eq(announcements.id, args.id) });
      if (!existing) throw new GraphQLError('Annonce introuvable', { extensions: { code: 'NOT_FOUND' } });
      const user = requireSchoolAdmin(ctx, existing.schoolId);

      const [updated] = await ctx.db
        .update(announcements)
        .set({ deletedAt: null })
        .where(eq(announcements.id, args.id))
        .returning();
      await auditService.log(ctx.db, {
        schoolId:    existing.schoolId,
        actorId:     user.membershipId,
        action:      'ANNOUNCEMENT_CREATED',
        entityType:  'announcement',
        entityId:    args.id,
        description: 'Annonce restaurée',
      });
      return updated;
    },
  },
};

// ── Audit Log ─────────────────────────────────────────────────
export const auditLogResolvers = {
  Query: {
    auditLogs: async (
      _: unknown,
      args: {
        filter: {
          schoolId: string; action?: string; entityType?: string;
          actorId?: string; startDate?: string; endDate?: string;
        };
        pagination?: { page: number; limit: number };
      },
      ctx: GraphQLContext
    ) => {
      // Vérifier que l'admin appartient bien à l'école demandée
      requireSchoolMember(ctx, args.filter.schoolId);
      requireAdmin(ctx);
      const page   = args.pagination?.page  ?? 1;
      const limit  = args.pagination?.limit ?? 20;
      const offset = (page - 1) * limit;

      const conditions = [eq(auditLogs.schoolId, args.filter.schoolId)];
      if (args.filter.action)     conditions.push(eq(auditLogs.action,     args.filter.action as any));
      if (args.filter.entityType) conditions.push(eq(auditLogs.entityType, args.filter.entityType));
      if (args.filter.actorId)    conditions.push(eq(auditLogs.actorId,    args.filter.actorId));

      const [data, total] = await Promise.all([
        ctx.db.query.auditLogs.findMany({
          where:   and(...conditions),
          limit,
          offset,
          orderBy: (a, { desc }) => [desc(a.createdAt)],
          with:    { actor: { with: { profile: true } } },
        }),
        ctx.db.select({ count: count() }).from(auditLogs).where(and(...conditions)),
      ]);

      const totalCount = Number(total[0].count);
      return {
        data,
        pageInfo: {
          hasNextPage:     offset + limit < totalCount,
          hasPreviousPage: page > 1,
          totalCount,
          currentPage:     page,
          totalPages:      Math.ceil(totalCount / limit),
        },
      };
    },
  },
};
