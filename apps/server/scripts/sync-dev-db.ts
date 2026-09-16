#!/usr/bin/env bun
/**
 * 本地开发库从远端 gateway 同步（一次性工具，非交付物）
 *
 * 背景：本地 PGlite 开发库多次因并发打开损坏（见 AGENTS.md 的 PGlite 单实例纪律）。
 * 与其反复修快照，不如从权威源（远端 gateway）重建——这也是更可靠的做法。
 *
 * 用法：
 *   cd apps/server && bun scripts/sync-dev-db.ts <远端URL>
 * 前置：本地 gateway 必须已停止（PGlite 单实例）；脚本自身连本地库写入。
 */
import { ensureDb, rowsOf, type DbInstance } from '@x-cartographer/db';
import { sql } from 'drizzle-orm';

const remoteUrl = process.argv[2] ?? 'http://100.80.110.125:8787';
let db: DbInstance;

const q = async <T = Record<string, unknown>>(s: string): Promise<T[]> =>
  rowsOf(await db.execute(sql.raw(s))) as T[];

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${remoteUrl}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

interface RemoteProduct {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  provenance?: string;
  user_activities?: Array<{
    id: string;
    name: string;
    description?: string;
    order?: number;
    provenance?: string;
    user_tasks?: Array<{ id: string; name: string; description?: string; order?: number; provenance?: string }>;
    stories?: Array<Record<string, unknown>>;
  }>;
}

async function main(): Promise<void> {
  db = await ensureDb();
  console.log(`=== 从 ${remoteUrl} 同步本地开发库 ===`);

  // 清空本地（保留 schema；顺序照顾外键）
  const tables = ['status_changes', 'dev_tasks', 'user_stories', 'user_tasks', 'user_activities', 'milestones', 'adr_records', 'system_modules', 'products'];
  for (const t of tables) {
    try { await db.execute(sql.raw(`DELETE FROM "${t}"`)); } catch { /* 表可能不存在 */ }
  }
  console.log('  本地已清空');

  // 产品 + 深树
  const products = await fetchJson<RemoteProduct[]>('/api/products');
  let actN = 0, utN = 0, storyN = 0, taskN = 0, msN = 0, modN = 0;

  for (const p of products) {
    await db.execute(sql`
      INSERT INTO products (id, name, description, metadata, settings, provenance)
      VALUES (${p.id}, ${p.name}, ${p.description ?? ''},
              ${JSON.stringify(p.metadata ?? {})}::jsonb,
              ${JSON.stringify(p.settings ?? {})}::jsonb,
              ${p.provenance ?? 'agent_inferred'})`);

    // 版本
    const milestones = await fetchJson<Array<Record<string, unknown>>>(`/api/milestones?productId=${p.id}`);
    for (const m of milestones) {
      await db.execute(sql`
        INSERT INTO milestones (id, product_id, name, goal, target_date, status, provenance)
        VALUES (${String(m.id)}, ${p.id}, ${String(m.name)}, ${String(m.goal ?? '')},
                ${m.target_date ? String(m.target_date) : null}, ${String(m.status ?? 'planned')},
                ${String(m.provenance ?? 'agent_inferred')})`);
      msN++;
    }

    // 模块目录
    const modules = await fetchJson<Array<Record<string, unknown>>>(`/api/system-modules?productId=${p.id}`);
    for (const mod of modules) {
      await db.execute(sql`
        INSERT INTO system_modules (id, product_id, name, path, responsibility, depends_on, provenance)
        VALUES (${String(mod.id)}, ${p.id}, ${String(mod.name)}, ${String(mod.path ?? '')},
                ${String(mod.responsibility ?? '')}, ${JSON.stringify(mod.depends_on ?? [])}::jsonb,
                ${String(mod.provenance ?? 'agent_inferred')})`);
      modN++;
    }

    // 活动 → 用户任务 → 故事 → 研发任务
    for (const a of p.user_activities ?? []) {
      await db.execute(sql`
        INSERT INTO user_activities (id, product_id, name, description, "order", provenance)
        VALUES (${a.id}, ${p.id}, ${a.name}, ${a.description ?? ''}, ${a.order ?? 0},
                ${a.provenance ?? 'agent_inferred'})`);
      actN++;
      for (const ut of a.user_tasks ?? []) {
        await db.execute(sql`
          INSERT INTO user_tasks (id, activity_id, name, description, "order", provenance)
          VALUES (${ut.id}, ${a.id}, ${ut.name}, ${ut.description ?? ''}, ${ut.order ?? 0},
                  ${ut.provenance ?? 'agent_inferred'})`);
        utN++;
      }
      for (const s of a.stories ?? []) {
        await db.execute(sql`
          INSERT INTO user_stories (id, activity_id, user_task_id, milestone_id, title, description,
                                    priority, estimation, acceptance_criteria, tags, affected_modules,
                                    status, "order", provenance)
          VALUES (${String(s.id)}, ${a.id}, ${(s.user_task_id as string) ?? null},
                  ${(s.milestone_id as string) ?? null}, ${String(s.title)}, ${String(s.description ?? '')},
                  ${String(s.priority ?? 'medium')}, ${Number(s.estimation ?? 0)},
                  ${JSON.stringify(s.acceptance_criteria ?? [])}::jsonb,
                  ${JSON.stringify(s.tags ?? [])}::jsonb,
                  ${JSON.stringify(s.affected_modules ?? [])}::jsonb,
                  ${String(s.status ?? 'backlog')}, ${Number(s.order ?? 0)},
                  ${String(s.provenance ?? 'agent_inferred')})`);
        storyN++;
        for (const t of (s.dev_tasks as Array<Record<string, unknown>>) ?? []) {
          await db.execute(sql`
            INSERT INTO dev_tasks (id, story_id, title, description, priority, estimation, status,
                                   dependencies, tags, affected_modules, assignee)
            VALUES (${String(t.id)}, ${String(s.id)}, ${String(t.title)}, ${String(t.description ?? '')},
                    ${String(t.priority ?? 'P2')}, ${Number(t.estimation ?? 0)}, ${String(t.status ?? 'backlog')},
                    ${JSON.stringify(t.dependencies ?? [])}::jsonb,
                    ${JSON.stringify(t.tags ?? [])}::jsonb,
                    ${JSON.stringify(t.affected_modules ?? [])}::jsonb,
                    ${(t.assignee as string) ?? null})`);
          taskN++;
        }
      }
    }
  }

  // 账本
  const changes = await fetchJson<Array<Record<string, unknown>>>('/api/status-changes');
  let scN = 0;
  for (const c of changes) {
    await db.execute(sql`
      INSERT INTO status_changes (id, entity_id, entity_type, previous_status, new_status, reason, changed_by, changed_at)
      VALUES (${String(c.id)}, ${String(c.entity_id)}, ${String(c.entity_type)},
              ${String(c.previous_status ?? '')}, ${String(c.new_status ?? '')},
              ${(c.reason as string) ?? null}, ${(c.changed_by as string) ?? null},
              ${String(c.changed_at ?? new Date().toISOString())})`);
    scN++;
  }

  const chk = await q<{ n: number }>('SELECT count(*)::int AS n FROM user_stories');
  console.log(`  产品=${products.length} 活动=${actN} 用户任务=${utN} 故事=${storyN} 任务=${taskN} 版本=${msN} 模块=${modN} 账本=${scN}`);
  console.log(`  校验：本地 user_stories = ${chk[0]?.n}`);
  console.log('SYNC DONE');
  process.exit(0);
}

main();
