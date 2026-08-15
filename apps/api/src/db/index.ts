import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const isNeon = process.env.DATABASE_URL.includes('neon.tech') ||
               process.env.DATABASE_URL.includes('neon.database.cloud') ||
               process.env.DATABASE_URL.includes('neondb');

let db: import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema>;

if (isNeon) {
  // ── Neon (serverless PostgreSQL) ─────────────────────────────
  const { neon }    = require('@neondatabase/serverless') as typeof import('@neondatabase/serverless');
  const { drizzle } = require('drizzle-orm/neon-http')   as typeof import('drizzle-orm/neon-http');
  const sql = neon(process.env.DATABASE_URL!);
  db = drizzle(sql, { schema }) as any;
  console.log('🌐 Neon (serverless) DB connection');
} else {
  // ── PostgreSQL local ─────────────────────────────────────────
  const { Pool }    = require('pg')                        as typeof import('pg');
  const { drizzle } = require('drizzle-orm/node-postgres') as typeof import('drizzle-orm/node-postgres');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max:                        10,
    idleTimeoutMillis:          30_000,
    connectionTimeoutMillis:    10_000, // 10s (Neon cold start handled above)
    ssl: process.env.DATABASE_URL.includes('sslmode=require')
         || process.env.DATABASE_URL.includes('sslmode=verify-full')
         ? { rejectUnauthorized: false }
         : false,
  });

  pool.on('error', (err: Error) => {
    console.error('Unexpected DB pool error:', err.message);
  });

  db = drizzle(pool, { schema }) as any;
  console.log('🐘 PostgreSQL (local) DB connection');
}

export { db };
export type DB = typeof db;
export * from './schema';
