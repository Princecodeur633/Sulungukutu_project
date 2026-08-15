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

  Subscription: {
    notificationAdded: {
      subscribe: (_: unknown, args: { profileId: string }) =>
        pubsub.subscribe('NOTIFICATION_ADDED', args.profileId),
      resolve: (payload: any) => payload.notificationAdded,
    },
    messageReceived: {
      // NOTE IMPORTANTE : avant ce correctif, le filtrage par `membershipId`
      // n'était pas appliqué — seul `schoolId` servait de canal, donc
      // n'importe quel membre abonné recevait le contenu de TOUS les
      // messages privés échangés dans l'établissement (sujet + contenu
      // inclus), pas seulement ceux qui lui étaient adressés.
      subscribe: (_: unknown, args: { schoolId: string; membershipId: string }) =>
        filterAsyncIterator(
          pubsub.subscribe('MESSAGE_RECEIVED', args.schoolId),
          (payload: any) => payload?.messageReceived?.receiverId === args.membershipId
        ),
      resolve: (payload: any) => payload.messageReceived,
    },
    attendanceUpdated: {
      subscribe: (_: unknown, args: { classSubjectId: string }) =>
        pubsub.subscribe('ATTENDANCE_UPDATED', args.classSubjectId),
      resolve: (payload: any) => payload.attendanceUpdated,
    },
    bulletinStatusChanged: {
      subscribe: (_: unknown, args: { studentId: string }) =>
        pubsub.subscribe('BULLETIN_STATUS', args.studentId),
      resolve: (payload: any) => payload.bulletinStatusChanged,
    },
    paymentStatusChanged: {
      subscribe: (_: unknown, args: { studentId: string }) =>
        pubsub.subscribe('PAYMENT_STATUS', args.studentId),
      resolve: (payload: any) => payload.paymentStatusChanged,
    },
    remotePaymentStatusChanged: {
      // Canal = transactionId : seul le parent/élève qui a initié le paiement
      // (et qui connaît la référence de sa transaction) suit son dénouement.
      subscribe: (_: unknown, args: { transactionId: string }) =>
        pubsub.subscribe('REMOTE_PAYMENT_STATUS', args.transactionId),
      resolve: (payload: any) => payload.remotePaymentStatusChanged,
    },
    announcementPublished: {
      subscribe: (_: unknown, args: { schoolId: string }) =>
        pubsub.subscribe('ANNOUNCEMENT_PUBLISHED', args.schoolId),
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

