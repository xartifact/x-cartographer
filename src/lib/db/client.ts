import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import * as schema from './schema';

type DbInstance = ReturnType<typeof drizzlePglite<typeof schema>>;

let db: DbInstance | null = null;
let pgliteClient: PGlite | null = null;
let initPromise: Promise<void> | null = null;

const TABLE_SQLS = [
  `CREATE TABLE IF NOT EXISTS "projects" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "metadata" jsonb DEFAULT '{"tech_stack":[],"version":"1.0.0","tags":[]}'::jsonb NOT NULL,
    "settings" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "status_changes" (
    "id" text PRIMARY KEY NOT NULL,
    "entity_id" text NOT NULL,
    "entity_type" text NOT NULL,
    "previous_status" text NOT NULL,
    "new_status" text NOT NULL,
    "reason" text,
    "changed_by" text,
    "changed_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "user_journeys" (
    "id" text PRIMARY KEY NOT NULL,
    "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "persona" text DEFAULT '' NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "user_stories" (
    "id" text PRIMARY KEY NOT NULL,
    "journey_id" text NOT NULL REFERENCES "user_journeys"("id") ON DELETE CASCADE,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "priority" text DEFAULT 'medium' NOT NULL,
    "estimation" real DEFAULT 0 NOT NULL,
    "acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "status" text DEFAULT 'backlog',
    "position" jsonb,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "tasks" (
    "id" text PRIMARY KEY NOT NULL,
    "story_id" text NOT NULL REFERENCES "user_stories"("id") ON DELETE CASCADE,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "type" text DEFAULT 'technical_task' NOT NULL,
    "priority" text DEFAULT 'P2' NOT NULL,
    "estimation" real DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'backlog' NOT NULL,
    "dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "assignee" text,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
];

function createPgliteClient(): PGlite {
  if (typeof window !== 'undefined') {
    return new PGlite('idb://x-product-roadmap');
  }
  return new PGlite('./data/pglite');
}

async function initializeDb(): Promise<void> {
  if (!pgliteClient) {
    console.log('[DB] Creating PGlite client...');
    pgliteClient = createPgliteClient();
  }
  // 逐条执行建表 SQL
  for (const sql of TABLE_SQLS) {
    await pgliteClient.exec(sql);
  }
  console.log('[DB] Tables created successfully');
  db = drizzlePglite(pgliteClient, { schema });
  console.log('[DB] Drizzle instance ready');
}

export async function ensureDb(): Promise<DbInstance> {
  if (db) return db;

  if (!initPromise) {
    initPromise = initializeDb();
  }
  await initPromise;
  return db!;
}

export function getDb(): DbInstance {
  if (!db) {
    throw new Error('Database not initialized. Call ensureDb() first.');
  }
  return db;
}

export type { DbInstance };
