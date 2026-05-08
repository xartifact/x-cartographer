import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: '../../packages/core/src/db/schema/index.ts',
  out: './src/lib/db/migrations',
  ...(databaseUrl
    ? { dbCredentials: { url: databaseUrl } }
    : { driver: 'pglite', dbCredentials: { url: '../../data/pglite' } }),
});
