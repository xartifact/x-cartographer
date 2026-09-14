#!/usr/bin/env bun
/**
 * 生产备份还原脚本：从 REST 快照（旧体系 JSON）导入本地旧 schema 库，
 * 供随后 run-migrate-story-map.ts 在真实生产量级上验证迁移。
 *
 * 用法：cd apps/server && bun scripts/restore-backup.ts <backup_dir> [product_id]
 *   backup_dir  含 tree-*.json / milestones-*.json / tasks-all.json / changes-all.json 的目录
 *   product_id  可选：只还原指定产品（默认全部）
 *
 * 前提：当前库为空（或 --fresh 指示清空重建旧 schema）。
 * 旧 schema（0000-0002 形态）：projects/user_journeys/user_stories/tasks/milestones/status_changes/app_settings
 */
import { PGlite } from '../../../node_modules/.bun/@electric-sql+pglite@0.4.6/node_modules/@electric-sql/pglite/dist/index.js';

const backupDir = process.argv[2];
if (!backupDir) { console.error('用法: bun scripts/restore-backup.ts <backup_dir> [product_id]'); process.exit(1); }
const onlyProduct = process.argv[3];
const DB_DIR = process.env.RESTORE_DB_DIR ?? './data/pglite-restore';
const db = new PGlite(DB_DIR);

// ── 旧 schema DDL（0000-0002 形态，与生产库结构一致）──────────────
await db.exec(`
CREATE TABLE IF NOT EXISTS "projects" (
  "id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "description" text,
  "metadata" jsonb DEFAULT '{"tech_stack":[],"version":"1.0.0","tags":[]}'::jsonb NOT NULL,
  "settings" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "user_journeys" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL, "description" text DEFAULT '' NOT NULL, "persona" text DEFAULT '' NOT NULL,
  "priority" text DEFAULT 'medium' NOT NULL, "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "milestones" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL, "goal" text DEFAULT '' NOT NULL, "target_date" timestamp with time zone,
  "status" text DEFAULT 'planned' NOT NULL, "adr_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "user_stories" (
  "id" text PRIMARY KEY NOT NULL,
  "journey_id" text NOT NULL REFERENCES "user_journeys"("id") ON DELETE CASCADE,
  "milestone_id" text REFERENCES "milestones"("id") ON DELETE SET NULL,
  "title" text NOT NULL, "description" text DEFAULT '' NOT NULL, "priority" text DEFAULT 'medium' NOT NULL,
  "estimation" real DEFAULT 0 NOT NULL, "acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL, "status" text DEFAULT 'backlog', "position" jsonb,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "story_id" text REFERENCES "user_stories"("id") ON DELETE CASCADE,
  "project_id" text REFERENCES "projects"("id") ON DELETE CASCADE,
  "title" text NOT NULL, "description" text DEFAULT '' NOT NULL,
  "type" text DEFAULT 'technical_task' NOT NULL, "priority" text DEFAULT 'P2' NOT NULL,
  "estimation" real DEFAULT 0 NOT NULL, "status" text DEFAULT 'backlog' NOT NULL,
  "dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL, "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "assignee" text, "started_at" timestamp with time zone, "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "status_changes" (
  "id" text PRIMARY KEY NOT NULL, "entity_id" text NOT NULL, "entity_type" text NOT NULL,
  "previous_status" text NOT NULL, "new_status" text NOT NULL, "reason" text, "changed_by" text,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY NOT NULL, "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
`);

const esc = (v: unknown): string => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const jesc = (v: unknown): string => v === null || v === undefined ? 'NULL' : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const d = (v: unknown): string => v ? `'${String(v)}'` : 'NULL';

let counts = { projects: 0, journeys: 0, stories: 0, tasks: 0, milestones: 0, changes: 0 };

// ── products ──
const files = (await Array.fromAsync(new Bun.Glob('tree-*.json').scan({ cwd: backupDir }))).sort();
for (const f of files) {
  const tree = await Bun.file(`${backupDir}/${f}`).json();
  if (onlyProduct && tree.id !== onlyProduct) continue;
  await db.exec(`INSERT INTO projects (id, name, description, metadata, settings, created_at, updated_at)
    VALUES (${esc(tree.id)}, ${esc(tree.name)}, ${esc(tree.description ?? '')}, ${jesc(tree.metadata ?? {})}, ${jesc(tree.settings ?? { auto_save: true, display_preferences: { show_priority_colors: true, show_estimation: true, default_view: 'map' } })}, ${d(tree.created_at)}, ${d(tree.updated_at)})
    ON CONFLICT (id) DO NOTHING`);
  counts.projects++;

  // milestones（按产品拉取的文件）
  try {
    const ms = await Bun.file(`${backupDir}/milestones-${tree.id}.json`).json();
    for (const m of ms) {
      await db.exec(`INSERT INTO milestones (id, project_id, name, goal, target_date, status, adr_id, created_at, updated_at)
        VALUES (${esc(m.id)}, ${esc(tree.id)}, ${esc(m.name)}, ${esc(m.goal ?? '')}, ${d(m.target_date)}, ${esc(m.status ?? 'planned')}, ${esc(m.adr_id ?? null)}, ${d(m.created_at)}, ${d(m.updated_at)})
        ON CONFLICT (id) DO NOTHING`);
      counts.milestones++;
    }
  } catch { /* 无该产品 milestone 文件 */ }

  // journeys + stories + tasks（深树，milestones 已先行插入）
  for (const j of tree.user_journeys ?? []) {
    await db.exec(`INSERT INTO user_journeys (id, project_id, name, description, persona, "order", created_at, updated_at)
      VALUES (${esc(j.id)}, ${esc(tree.id)}, ${esc(j.name)}, ${esc(j.description ?? '')}, ${esc(j.persona ?? '')}, ${j.order ?? 0}, ${d(j.created_at)}, ${d(j.updated_at)})
      ON CONFLICT (id) DO NOTHING`);
    counts.journeys++;
    for (const s of j.stories ?? []) {
      await db.exec(`INSERT INTO user_stories (id, journey_id, milestone_id, title, description, priority, estimation, acceptance_criteria, tags, status, position, "order", created_at, updated_at)
        VALUES (${esc(s.id)}, ${esc(s.journey_id)}, ${esc(s.milestone_id ?? null)}, ${esc(s.title)}, ${esc(s.description ?? '')}, ${esc(s.priority)}, ${s.estimation ?? 0}, ${jesc(s.acceptance_criteria ?? [])}, ${jesc(s.tags ?? [])}, ${esc(s.status ?? 'backlog')}, ${s.position ? jesc(s.position) : 'NULL'}, ${s.order ?? 0}, ${d(s.created_at)}, ${d(s.updated_at)})
        ON CONFLICT (id) DO NOTHING`);
      counts.stories++;
      for (const t of s.tasks ?? []) {
        await db.exec(`INSERT INTO tasks (id, story_id, project_id, title, description, type, priority, estimation, status, dependencies, tags, assignee, started_at, completed_at, created_at, updated_at)
          VALUES (${esc(t.id)}, ${esc(s.id)}, ${esc(tree.id)}, ${esc(t.title)}, ${esc(t.description ?? '')}, ${esc(t.type ?? 'technical_task')}, ${esc(t.priority)}, ${t.estimation ?? 0}, ${esc(t.status ?? 'backlog')}, ${jesc(t.dependencies ?? [])}, ${jesc(t.tags ?? [])}, ${esc(t.assignee ?? null)}, ${d(t.started_at)}, ${d(t.completed_at)}, ${d(t.created_at)}, ${d(t.updated_at)})
          ON CONFLICT (id) DO NOTHING`);
        counts.tasks++;
      }
    }
  }

  // milestones（按产品拉取的文件）
  try {
    const ms = await Bun.file(`${backupDir}/milestones-${tree.id}.json`).json();
    for (const m of ms) {
      await db.exec(`INSERT INTO milestones (id, project_id, name, goal, target_date, status, adr_id, created_at, updated_at)
        VALUES (${esc(m.id)}, ${esc(tree.id)}, ${esc(m.name)}, ${esc(m.goal ?? '')}, ${d(m.target_date)}, ${esc(m.status ?? 'planned')}, ${esc(m.adr_id ?? null)}, ${d(m.created_at)}, ${d(m.updated_at)})
        ON CONFLICT (id) DO NOTHING`);
      counts.milestones++;
    }
  } catch { /* 无该产品 milestone 文件 */ }
}

// ── status_changes（全量单文件，product 维度无关）──
try {
  const changes = await Bun.file(`${backupDir}/changes-all.json`).json();
  if (Array.isArray(changes)) {
    for (const c of changes) {
      await db.exec(`INSERT INTO status_changes (id, entity_id, entity_type, previous_status, new_status, reason, changed_by, changed_at)
        VALUES (${esc(c.id)}, ${esc(c.entity_id)}, ${esc(c.entity_type)}, ${esc(c.previous_status)}, ${esc(c.new_status)}, ${esc(c.reason ?? null)}, ${esc(c.changed_by ?? null)}, ${d(c.changed_at)})
        ON CONFLICT (id) DO NOTHING`);
      counts.changes++;
    }
  }
} catch { console.warn('changes-all.json 缺失或非数组，跳过'); }

console.log(`restored: ${JSON.stringify(counts)}`);
console.log(`db dir: ${DB_DIR}`);
console.log('下一步: 1) XPR_DB_DIR 指向该目录跑 scripts/run-migrate-story-map.ts  2) 起 gateway 验证');
process.exit(0);
