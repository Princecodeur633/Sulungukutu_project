import 'dotenv/config';
import { createServer }  from 'http';
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync }  from 'fs';
import { join }          from 'path';
import { DateTimeResolver, JSONResolver } from 'graphql-scalars';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';

import { pubsub }             from './pubsub';
import { buildContext, buildWsContext }       from './middleware/auth';
import { authResolvers }         from './resolvers/auth/auth.resolver';
import { schoolResolvers }       from './resolvers/school/school.resolver';
import { levelResolvers }        from './resolvers/level/level.resolver';
import { classResolvers }        from './resolvers/class/class.resolver';
import { subjectResolvers }      from './resolvers/subject/subject.resolver';
import { studentResolvers }      from './resolvers/student/student.resolver';
import { gradeResolvers }        from './resolvers/grade/grade.resolver';
import { attendanceResolvers }   from './resolvers/attendance/attendance.resolver';
import { paymentResolvers }      from './resolvers/payment/payment.resolver';
import { bulletinResolvers }     from './resolvers/bulletin/bulletin.resolver';
import {
  messageResolvers,
  notificationResolvers,
  announcementResolvers,
  auditLogResolvers,
}                                from './resolvers/comms/comms.resolver';
import { dashboardResolvers }    from './resolvers/dashboard/dashboard.resolver';
import { scheduleResolvers }     from './resolvers/schedule/schedule.resolver';
import { userResolvers }         from './resolvers/user/user.resolver';
import { initCronJobs }          from './jobs/payment-reminder.job';
import { handleExport }          from './routes/export.routes';
import { handlePdfRoute }          from './routes/pdf.routes';
import { handleMailViewer }      from './routes/mail-viewer.routes';
import { handleImportRoute }     from './routes/import.routes';
import { GraphQLError } from 'graphql';
import { eq } from 'drizzle-orm';
import { classSubjects, paymentTransactions } from './db/schema';
import { requireAuth, requireSchoolMember, requireStudentAccess } from './middleware/permissions';
import type { GraphQLContext } from './middleware/auth';

// ── Charger le schéma GraphQL ─────────────────────────────────
const typeDefs = readFileSync(
  join(__dirname, 'schema', 'appsync-schema.gql'),
  'utf-8'
);

// ── Fusionner tous les resolvers ──────────────────────────────

// Filtre un itérateur asynchrone de pubsub pour ne laisser passer que les
// évènements qui concernent réellement l'abonné (voir messageReceived
// ci-dessous : le sujet pubsub est partagé par toute l'école, donc sans ce
// filtre, tout le monde recevait le contenu de tous les messages privés
// échangés dans l'établissement, pas seulement les leurs).
async function* filterAsyncIterator<T>(
  iterator: AsyncIterable<T>,
  predicate: (payload: T) => boolean
): AsyncGenerator<T> {
  for await (const payload of iterator) {
    if (predicate(payload)) yield payload;
  }
}

const resolvers = {
  DateTime: DateTimeResolver,
  JSON:     JSONResolver,

  Query: {
    ...authResolvers.Query,
    ...schoolResolvers.Query,
    ...levelResolvers.Query,
    ...classResolvers.Query,
    ...subjectResolvers.Query,
    ...studentResolvers.Query,
    ...gradeResolvers.Query,
    ...attendanceResolvers.Query,
    ...paymentResolvers.Query,
    ...bulletinResolvers.Query,
    ...messageResolvers.Query,
    ...notificationResolvers.Query,
    ...announcementResolvers.Query,
    ...auditLogResolvers.Query,
    ...dashboardResolvers.Query,
    ...scheduleResolvers.Query,
    ...userResolvers.Query,
  },

  Mutation: {
    ...authResolvers.Mutation,
    ...schoolResolvers.Mutation,
    ...levelResolvers.Mutation,
    ...classResolvers.Mutation,
    ...subjectResolvers.Mutation,
    ...studentResolvers.Mutation,
    ...gradeResolvers.Mutation,
    ...attendanceResolvers.Mutation,
    ...paymentResolvers.Mutation,
    ...bulletinResolvers.Mutation,
    ...messageResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...announcementResolvers.Mutation,
    ...scheduleResolvers.Mutation,
    ...userResolvers.Mutation,
  },

  // Field resolvers
  Class:    classResolvers.Class,
  Bulletin: bulletinResolvers.Bulletin,
  Payment: {
    recuUrl: (payment: any) =>
      ['PAYE', 'EXONERE'].includes(payment.statut) ? `/pdf/recu/${payment.id}` : null,
  },
  PaymentTransaction: {
    recuUrl: (tx: any) =>
      tx.statut === 'VALIDEE' && tx.paymentId ? `/pdf/recu/${tx.paymentId}` : null,
  },

  Subscription: {
    notificationAdded: {
      subscribe: (_: unknown, args: { profileId: string }, ctx: GraphQLContext) => {
        const user = requireAuth(ctx);
        if (args.profileId !== user.profileId) {
          throw new GraphQLError('Accès refusé à ces notifications.', { extensions: { code: 'FORBIDDEN' } });
        }
        return pubsub.subscribe('NOTIFICATION_ADDED', args.profileId);
      },
      resolve: (payload: any) => payload.notificationAdded,
    },
    messageReceived: {
      subscribe: (_: unknown, args: { schoolId: string; membershipId: string }, ctx: GraphQLContext) => {
        const user = requireAuth(ctx);
        requireSchoolMember(ctx, args.schoolId);
        if (user.role !== 'SUPER_ADMIN' && args.membershipId !== user.membershipId) {
          throw new GraphQLError('Accès refusé à cette messagerie.', { extensions: { code: 'FORBIDDEN' } });
        }
        return filterAsyncIterator(
          pubsub.subscribe('MESSAGE_RECEIVED', args.schoolId),
          (payload: any) => payload?.messageReceived?.receiverId === args.membershipId
        );
      },
      resolve: (payload: any) => payload.messageReceived,
    },
    attendanceUpdated: {
      subscribe: async (_: unknown, args: { classSubjectId: string }, ctx: GraphQLContext) => {
        const user = requireAuth(ctx);
        const cs = await ctx.db.query.classSubjects.findFirst({
          where: eq(classSubjects.id, args.classSubjectId),
          with: { class: true },
        });
        if (!cs) {
          throw new GraphQLError('Association introuvable', { extensions: { code: 'NOT_FOUND' } });
        }
        requireSchoolMember(ctx, (cs as any).class.schoolId);
        if (!['ADMIN', 'SUPER_ADMIN', 'TEACHER'].includes(user.role)) {
          throw new GraphQLError('Accès refusé.', { extensions: { code: 'FORBIDDEN' } });
        }
        if (user.role === 'TEACHER' && cs.teacherMembershipId !== user.membershipId) {
          throw new GraphQLError('Accès refusé à cette classe.', { extensions: { code: 'FORBIDDEN' } });
        }
        return pubsub.subscribe('ATTENDANCE_UPDATED', args.classSubjectId);
      },
      resolve: (payload: any) => payload.attendanceUpdated,
    },
    bulletinStatusChanged: {
      subscribe: async (_: unknown, args: { studentId: string }, ctx: GraphQLContext) => {
        requireAuth(ctx);
        const student = await ctx.db.query.students.findFirst({
          where: (t, { eq: e }) => e(t.id, args.studentId),
          with: { class: true },
        });
        if (!student) {
          throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireStudentAccess(ctx, args.studentId, (student as any).class.schoolId);
        return pubsub.subscribe('BULLETIN_STATUS', args.studentId);
      },
      resolve: (payload: any) => payload.bulletinStatusChanged,
    },
    paymentStatusChanged: {
      subscribe: async (_: unknown, args: { studentId: string }, ctx: GraphQLContext) => {
        requireAuth(ctx);
        const student = await ctx.db.query.students.findFirst({
          where: (t, { eq: e }) => e(t.id, args.studentId),
          with: { class: true },
        });
        if (!student) {
          throw new GraphQLError('Élève introuvable', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireStudentAccess(ctx, args.studentId, (student as any).class.schoolId);
        return pubsub.subscribe('PAYMENT_STATUS', args.studentId);
      },
      resolve: (payload: any) => payload.paymentStatusChanged,
    },
    remotePaymentStatusChanged: {
      subscribe: async (_: unknown, args: { transactionId: string }, ctx: GraphQLContext) => {
        requireAuth(ctx);
        const tx = await ctx.db.query.paymentTransactions.findFirst({
          where: eq(paymentTransactions.id, args.transactionId),
          with: { student: { with: { class: true } } },
        });
        if (!tx) {
          throw new GraphQLError('Transaction introuvable', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireStudentAccess(ctx, tx.studentId, (tx as any).student.class.schoolId);
        return pubsub.subscribe('REMOTE_PAYMENT_STATUS', args.transactionId);
      },
      resolve: (payload: any) => payload.remotePaymentStatusChanged,
    },
    announcementPublished: {
      subscribe: (_: unknown, args: { schoolId: string }, ctx: GraphQLContext) => {
        requireSchoolMember(ctx, args.schoolId);
        return pubsub.subscribe('ANNOUNCEMENT_PUBLISHED', args.schoolId);
      },
      resolve: (payload: any) => payload.announcementPublished,
    },
  },
};

// ── Créer le schema exécutable ────────────────────────────────
const schema = makeExecutableSchema({ typeDefs, resolvers });

// ── Créer l'instance Yoga ─────────────────────────────────────
const yoga = createYoga({
  schema,
  context:    buildContext,
  graphqlEndpoint: '/graphql',
  healthCheckEndpoint: '/health',
  cors: {
    origin:      process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
  logging: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
});

// ── Créer le serveur HTTP ─────────────────────────────────────
// Le serveur gère :
//   /export/* → téléchargements Excel (binaire)
//   /graphql   → API GraphQL (Yoga)
//   /health    → health check
const server = createServer((req, res) => {
  // Routes d'export binaire
  if (handlePdfRoute(req, res)) return;
  if (handleMailViewer(req, res)) return;
  if (handleImportRoute(req, res)) return;
  if (handleExport(req, res)) return;

  // Tout le reste → GraphQL Yoga
  yoga.handle(req, res);
});

// ── Serveur WebSocket (abonnements temps réel) ─────────────────
// NOTE IMPORTANTE : ceci était totalement absent auparavant. Le client
// (apps/web/src/lib/apollo/client.ts) se connecte via `graphql-ws` sur une
// vraie connexion WebSocket (ws://.../graphql), mais graphql-yoga, seul, ne
// sert les abonnements que sur son propre transport SSE via /graphql en
// HTTP simple — pas compatible avec ce que le client attend. Résultat concret
// avant ce correctif : AUCUN abonnement ne pouvait jamais s'établir
// (notifications, messages, bulletins...), ils tombaient tous en erreur de
// connexion silencieusement, sans qu'aucune page ne s'en aperçoive vraiment
// grâce aux rafraîchissements périodiques de secours.
const wsServer = new WebSocketServer({
  server,
  path: '/graphql',
});

const wsServerCleanup = useServer(
  {
    schema,
    context: async (ctx) => buildWsContext(ctx.connectionParams as Record<string, unknown> | undefined),
  },
  wsServer
);

const PORT = parseInt(process.env.PORT ?? '4000', 10);

server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║     🎓 sulungukutu API — v1.0.0        ║
  ╠════════════════════════════════════════╣
  ║  GraphQL  : http://localhost:${PORT}/graphql  ║
  ║  WS       : ws://localhost:${PORT}/graphql    ║
  ║  Health   : http://localhost:${PORT}/health   ║
  ║  Env      : ${process.env.NODE_ENV ?? 'development'}               ║
  ╚════════════════════════════════════════╝
  `);

  // Démarrer les cron jobs
  if (process.env.NODE_ENV !== 'test') {
    initCronJobs();
  }
});

// ── Gestion propre de l'arrêt ─────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM reçu, arrêt propre...');
  wsServerCleanup.dispose();
  server.close(() => {
    console.log('[Server] Serveur arrêté.');
    process.exit(0);
  });
});

