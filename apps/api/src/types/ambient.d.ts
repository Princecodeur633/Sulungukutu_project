// Ces deux paquets ont bien des fichiers .d.ts dans leur dossier `dist`,
// mais celui-ci n'est atteignable qu'avec moduleResolution "node16" /
// "bundler" (notre tsconfig utilise "node" classique). Plutôt que de
// changer moduleResolution pour tout le projet (risque de régressions sur
// d'autres imports), on déclare ces deux modules explicitement ici.
declare module 'graphql-ws/use/ws' {
  import type { ServerOptions } from 'graphql-ws';
  import type { WebSocketServer } from 'ws';
  export function useServer(options: ServerOptions, ws: WebSocketServer): { dispose: () => Promise<void> };
}

declare module 'node-cron';
