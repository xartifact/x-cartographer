/**
 * 约束追溯（apps/server/src/lib/trace.ts）
 *
 * 回答一个问题：「这条用户价值，被哪些架构约束管着？落在哪些模块？由哪些工作实现？」
 * —— 域模型 §2.3 的两分（意图被满足 / 规矩被遵守）在数据上已经齐了：
 *   story.affected_modules / adr.module_ids / task.story_id / task.module_id
 * 缺的只是把它们 join 起来的读路径。本模块是纯读、零裁决（§3.5）。
 *
 * 三个入口（任选其一）：
 *   storyId  → 该故事涉及的模块 + 模块上的 ADR + 实现它的 DevTask
 *   moduleId → 该模块承载的 ADR + 故事 + 任务（含脱离 story 的工程治理任务）
 *   adrId    → 该决策涉及的模块 + 受影响故事
 *
 * 数据源用直接 SQL（账本式读取，量级几百实体，可读性优先）。
 */
import { ensureDb, rowsOf, AdrRepository } from '@x-cartographer/db';
import { sql } from 'drizzle-orm';

export interface TraceStory {
  id: string;
  title: string;
  status: string;
  affected_modules: string[];
  product_id: string;
}

export interface TraceModule {
  id: string;
  name: string;
  product_id: string;
}

export interface TraceTask {
  id: string;
  title: string;
  status: string;
  story_id: string | null;
  module_id: string | null;
  product_id: string | null;
}

export interface TraceAdr {
  id: string;
  title: string;
  status: string;
  module_ids: string[];
  product_id: string;
}

export interface TraceResult {
  entry: { kind: 'story' | 'module' | 'adr'; id: string };
  product_id: string;
  stories: TraceStory[];
  modules: TraceModule[];
  adrs: TraceAdr[];
  tasks: TraceTask[];
}

async function loadAllStories(): Promise<TraceStory[]> {
  const db = await ensureDb();
  const rows = rowsOf(
    await db.execute(sql`
      SELECT s.id, s.title, s.status, s.affected_modules, a.product_id
      FROM user_stories s
      JOIN user_activities a ON a.id = s.activity_id
      ORDER BY s.id`)
  );
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    status: String(r.status),
    affected_modules: (r.affected_modules as string[] | null) ?? [],
    product_id: String(r.product_id),
  }));
}

async function loadAllTasks(): Promise<TraceTask[]> {
  const db = await ensureDb();
  const rows = rowsOf(
    await db.execute(sql`
      SELECT id, title, status, story_id, module_id, product_id
      FROM dev_tasks ORDER BY id`)
  );
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    status: String(r.status),
    story_id: r.story_id ? String(r.story_id) : null,
    module_id: r.module_id ? String(r.module_id) : null,
    product_id: r.product_id ? String(r.product_id) : null,
  }));
}

async function loadAllModules(): Promise<TraceModule[]> {
  const db = await ensureDb();
  const rows = rowsOf(
    await db.execute(sql`SELECT id, name, product_id FROM system_modules ORDER BY id`)
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    product_id: String(r.product_id),
  }));
}

async function loadAllAdrs(): Promise<TraceAdr[]> {
  const db = await ensureDb();
  const rows = rowsOf(
    await db.execute(sql`
      SELECT id, title, status, module_ids, product_id
      FROM adr_records ORDER BY id`)
  );
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    status: String(r.status),
    module_ids: (r.module_ids as string[] | null) ?? [],
    product_id: String(r.product_id),
  }));
}

export async function trace(entry: { kind: 'story' | 'module' | 'adr'; id: string }): Promise<TraceResult | null> {
  const [stories, tasks, modules, adrs] = await Promise.all([
    loadAllStories(),
    loadAllTasks(),
    loadAllModules(),
    loadAllAdrs(),
  ]);

  if (entry.kind === 'story') {
    const story = stories.find((s) => s.id === entry.id);
    if (!story) return null;
    const mods = story.affected_modules;
    return {
      entry,
      product_id: story.product_id,
      stories: [story],
      modules: modules.filter((m) => mods.includes(m.id)),
      adrs: adrs.filter((a) => a.module_ids.some((m) => mods.includes(m))),
      tasks: tasks.filter(
        (t) =>
          // 直挂该 story 的任务不看 product_id——经 story 派生归属（多数历史任务
          // product_id 为 NULL，0008 只回填过存量），跨产品误配由 story 归属兜底
          t.story_id === entry.id ||
          // 模块锚定任务（工程治理类）以产品圈定，避免跨产品同名模块误收
          (t.module_id !== null && mods.includes(t.module_id) && t.product_id === story.product_id)
      ),
    };
  }

  if (entry.kind === 'module') {
    const mod = modules.find((m) => m.id === entry.id);
    if (!mod) return null;
    return {
      product_id: mod.product_id,
      stories: stories.filter((s) => s.affected_modules.includes(entry.id) && s.product_id === mod.product_id),
      modules: [mod],
      adrs: adrs.filter((a) => a.module_ids.includes(entry.id)),
      tasks: tasks.filter((t) => t.module_id === entry.id),
    };
  }

  const adr = adrs.find((a) => a.id === entry.id);
  if (!adr) return null;
  const mods = adr.module_ids;
  return {
    entry,
    product_id: adr.product_id,
    stories: stories.filter(
      (s) => s.product_id === adr.product_id && s.affected_modules.some((m) => mods.includes(m))
    ),
    modules: modules.filter((m) => mods.includes(m.id)),
    adrs: [adr],
    tasks: tasks.filter((t) => t.module_id !== null && mods.includes(t.module_id) && t.product_id === adr.product_id),
  };
}

export async function traceByQuery(query: {
  storyId?: string;
  moduleId?: string;
  adrId?: string;
}): Promise<TraceResult | { error: string }> {
  const provided = Object.entries(query).filter(([, v]) => v !== undefined && v !== '');
  if (provided.length === 0) {
    return { error: '需要 storyId | moduleId | adrId 之一' };
  }
  if (provided.length > 1) {
    return { error: '三个入口只能选一个' };
  }
  const [kind, id] = provided[0]!;
  const kindKey = kind === 'storyId' ? 'story' : kind === 'moduleId' ? 'module' : 'adr';
  const result = await trace({ kind: kindKey, id: String(id) });
  return result ?? { error: `未找到 ${kindKey}: ${id}` };
}
