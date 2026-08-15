# Copilot Instructions for sulungukutu

## Project structure
- This is a `pnpm` monorepo with two main apps:
  - `apps/api` = backend GraphQL server built with `graphql-yoga`, `@graphql-tools/schema`, and `Drizzle ORM`.
  - `apps/web` = frontend built with `Next.js 14` App Router, `Apollo Client`, and Tailwind CSS.
- Do not add new backend logic outside `apps/api` or new UI pages outside `apps/web` unless a shared utility is required.

## Key entry points
- Backend startup: `apps/api/src/index.ts`
- GraphQL schema: `apps/api/src/schema/appsync-schema.gql`
- Feature resolvers: `apps/api/src/resolvers/*/*.resolver.ts`
- Auth context: `apps/api/src/middleware/auth.ts`
- Frontend Apollo setup: `apps/web/src/lib/apollo/client.ts`
- Frontend auth storage: `apps/web/src/lib/apollo/client.ts` (`tokenStorage`)
- Frontend route guarding: `apps/web/src/middleware.ts` is intentionally permissive; GraphQL auth is enforced by the API.

## What matters for changes
- Backend resolvers are organized by domain and merged in `apps/api/src/index.ts`. Match new queries/mutations with the same domain.
- Binary downloads and exports are routed separately in `apps/api/src/routes/*.ts` and are not part of GraphQL.
- The API uses JWT bearer tokens on every request. The frontend stores auth tokens in `localStorage` and sends them in `Authorization: Bearer ...` headers.
- Subscriptions use `graphql-ws` at the same GraphQL endpoint, configured in `apps/web/src/lib/apollo/client.ts`.

## Workflow & commands
- Install dependencies in the repo root: `pnpm install`
- Dev mode for both apps: `pnpm dev`
- Backend only: `pnpm --filter api dev`
- Frontend only: `pnpm --filter web dev`
- Build both: `pnpm build`
- API migration and database work via root commands:
  - `pnpm db:generate`
  - `pnpm db:migrate`
  - `pnpm db:push`
  - `pnpm db:seed`
  - `pnpm db:studio`
- End-to-end tests: `pnpm test:e2e`

## Env and deployment notes
- Backend env: `apps/api/.env.example`
- Frontend env: `apps/web/.env.example`
- Important env vars:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_WS_URL`
  - `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
- Production API startup runs migrations automatically in `apps/api/start-prod.sh`.

## Useful patterns
- Frontend query definitions are centralized in `apps/web/src/lib/graphql/queries/index.ts`.
- Global Apollo errors are mapped to French UI messages in `apps/web/src/lib/apollo/client.ts` and `apps/web/src/lib/errorUtils.ts`.
- Workspace switching and role-based dashboard routes use `apps/web/src/components/workspace-switcher/WorkspaceSwitcher.tsx`.
- The API has extra route handlers for exports, PDFs, import endpoints, and mail viewer, mounted before the GraphQL Yoga handler.

## Do not assume
- Do not assume client-side Next middleware enforces auth. The app relies on GraphQL token validation and frontend redirects.
- Do not assume GraphQL codegen exists. Queries are plain strings in the repo.
- Do not assume database schema changes are automatic; use Drizzle migrations via `drizzle-kit`.

## Best first fixes
- If adding a new GraphQL operation, update `apps/api/src/schema/appsync-schema.gql` and the matching resolver file.
- If adding a new export/download feature, add it in `apps/api/src/routes/export.routes.ts` rather than inside GraphQL.
- If auth-related logic changes, inspect both `apps/api/src/middleware/auth.ts` and `apps/web/src/lib/apollo/client.ts`.
