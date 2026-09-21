/**
 * 任务上下文切片（apps/server/src/lib/ctx.ts）
 *
 * P2（ai-native-product-principles.md）：「上下文是被设计出来的产物」。
 * Agent 领到一个任务时，需要的是**这个任务**的上下文切片，而不是产品全景：
 *   - 意图：它服务的 story（验收标准、优先级、里程碑）
 *   - 结构：它锚定的模块（职责、依赖了谁、谁依赖它）
 *   - 规矩：涉事模块上的 ADR（architecture_principles 摘要）
 *   - 实现：依赖 DAG（上游未完成的阻塞项）与同模块的兄弟任务
 *   - 证据：账本近况（谁在何时动过什么）
 *
 * 与 trace 的关系：trace 是实体视角的追溯链（story/module/adr 入口），
 * ctx 是任务视角的工作上下文——两者共享 join 逻辑，读路径互补。
 * 纯读、零裁决（§3.5）。
 */
import { ensureDb, rowsOf, AdrRepository } from '@x-cartographer/db';
import { sql } from 'drizzle-orm';

export interface CtxResult {
  task: {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    tags: string[];
    story_id: string | null;
    module_id: string | null;
    product_id: string | null;
  };
  story: {
    id: string;
    title: string;
    status: string;
    priority: string;
    acceptance_criteria: string[];
    milestone_id: string | null;
  } | null;
  modules: Array<{
    id: string;
    name: string;
    responsibility: string;
    path: string;
    depends_on: string[];
    /** 依赖的本模块（depends_on 反查，同级限定） */
    depended_by: string[];
  }>;
  /** 涉事模块上的架构原则（来自 ADR 折叠的当前态） */
  principles: Array<{
    id: string;
    statement: string;
    strength: string;
    /** 全局生效（无 module_ids）或圈定到这些模块 */
    module_ids: string[];
  }>;
  dependencies: {
    /** 上游依赖（本任务依赖它们） */
    upstream: Array<{ id: string; title: string; status: string; done: boolean }>;
    /** 下游（依赖本任务的任务） */
    downstream: Array<{ id: string; title: string; status: string }>;
  };
  siblings: Array<{ id: string; title: string; status: string }>;
  ledger: Array<{
    entity_id: string;
    previous_status: string;
    new_status: string;
    reason: string | null;
    changed_by: string | null;
    changed_at: string;
  }>;
}

export async function buildTaskContext(taskId: string): Promise<CtxResult | null> {
  const db = await ensureDb();

  // 1. 任务本体
  const taskRows = rowsOf(
    await db.execute(sql`
      SELECT id, title, description, status, priority, tags, story_id, module_id, product_id
      FROM dev_tasks WHERE id = ${taskId}`)
  );
  if (taskRows.length === 0) return null;
  const t = taskRows[0]!;
  const task = {
    id: String(t.id),
    title: String(t.title),
    description: String(t.description),
    status: String(t.status),
    priority: String(t.priority),
    tags: (t.tags as string[] | null) ?? [],
    story_id: t.story_id ? String(t.story_id) : null,
    module_id: t.module_id ? String(t.module_id) : null,
    product_id: t.product_id ? String(t.product_id) : null,
  };

  // 2. 产品归属兜底：product_id 缺失时经 story → activity 派生
  let productId = task.product_id;
  let story: CtxResult['story'] = null;
  if (task.story_id) {
    const sRows = rowsOf(
      await db.execute(sql`
        SELECT s.id, s.title, s.status, s.priority, s.acceptance_criteria, s.milestone_id, a.product_id
        FROM user_stories s JOIN user_activities a ON a.id = s.activity_id
        WHERE s.id = ${task.story_id}`)
    );
    if (sRows.length > 0) {
      const s = sRows[0]!;
      story = {
        id: String(s.id),
        title: String(s.title),
        status: String(s.status),
        priority: String(s.priority),
        acceptance_criteria: (s.acceptance_criteria as string[] | null) ?? [],
        milestone_id: s.milestone_id ? String(s.milestone_id) : null,
      };
      productId = productId ?? String(s.product_id);
    }
  }

  // 3. 模块锚定（含跨锚兜底：story 的 affected_modules 也算涉事模块）
  const modIds = new Set<string>(task.module_id ? [task.module_id] : []);
  if (task.story_id) {
    const smRows = rowsOf(
      await db.execute(sql`
        SELECT affected_modules FROM user_stories WHERE id = ${task.story_id}`)
    );
    for (const m of (smRows[0]?.affected_modules as string[] | null) ?? []) modIds.add(String(m));
  }

  const modules: CtxResult['modules'] = [];
  if (modIds.size > 0 && productId) {
    const modRows = rowsOf(
      await db.execute(sql`
        SELECT id, name, responsibility, path, depends_on
        FROM system_modules
        WHERE product_id = ${productId} AND id IN (${sql.join([...modIds].map((m) => sql`${m}`), sql`, `)})`)
    );
    for (const m of modRows) {
      const mid = String(m.id);
      // 反查：同产品目录内谁 depends_on 本模块
      const depBy = rowsOf(
        await db.execute(sql`
          SELECT id FROM system_modules
          WHERE product_id = ${productId} AND depends_on @> ${JSON.stringify([mid])}::jsonb`)
      );
      modules.push({
        id: mid,
        name: String(m.name),
        responsibility: String(m.responsibility),
        path: String(m.path),
        depends_on: (m.depends_on as string[] | null) ?? [],
        depended_by: depBy.map((d) => String(d.id)),
      });
    }
  }

  // 4. 规矩：涉事模块上的架构原则（ADR 折叠后的**生效**当前态 principles；ADR 本体的
  //    module_ids 标注涉事范围—— principles 无 module_ids = 项目全局生效 §3.5）
  //
  //    必须走 getEffectiveConstitution（内含 §3.3 的 acceptedAt 过滤）：
  //    曾直接 foldConstitution(listByProject(...))，绕过过滤，把 proposed ADR 的
  //    changes 当生效约束注入（与 adr current / task info 给出相反事实）。
  const principles: CtxResult['principles'] = [];
  if (productId) {
    const folded = await new AdrRepository().getEffectiveConstitution(productId);
    for (const p of folded.architecture_principles) {
      const pMods = p.module_ids ?? [];
      if (pMods.length === 0 || pMods.some((m) => modIds.has(m))) {
        principles.push({
          id: p.id,
          statement: p.statement,
          strength: p.strength,
          module_ids: pMods,
        });
      }
    }
  }

  // 5. 依赖 DAG + 同模块兄弟
  const deps = (rowsOf(
    await db.execute(sql`SELECT dependencies FROM dev_tasks WHERE id = ${taskId}`)
  )[0]?.dependencies as string[] | null) ?? [];
  const allIds = [...deps];
  const upstreamRows = allIds.length
    ? rowsOf(await db.execute(sql`
        SELECT id, title, status FROM dev_tasks
        WHERE id IN (${sql.join(deps.map((d) => sql`${d}`), sql`, `)})`))
    : [];
  const downstreamRows = rowsOf(await db.execute(sql`
    SELECT id, title, status FROM dev_tasks
    WHERE dependencies @> ${JSON.stringify([taskId])}::jsonb`));
  const siblingRows = task.module_id
    ? rowsOf(await db.execute(sql`
        SELECT id, title, status FROM dev_tasks
        WHERE module_id = ${task.module_id} AND id != ${taskId} ORDER BY id LIMIT 20`))
    : [];

  // 6. 账本近况（本任务 + 关联 story，按时间倒序取 10 条）
  const ledgerIds = [taskId, ...(task.story_id ? [task.story_id] : [])];
  const ledger = rowsOf(await db.execute(sql`
    SELECT entity_id, previous_status, new_status, reason, changed_by, changed_at
    FROM status_changes
    WHERE entity_id IN (${sql.join(ledgerIds.map((i) => sql`${i}`), sql`, `)})
    ORDER BY changed_at DESC, seq DESC LIMIT 10`)).map((r) => ({
    entity_id: String(r.entity_id),
    previous_status: String(r.previous_status),
    new_status: String(r.new_status),
    reason: r.reason ? String(r.reason) : null,
    changed_by: r.changed_by ? String(r.changed_by) : null,
    changed_at: String(r.changed_at),
  }));

  const DONE = new Set(['done', 'cancelled', 'accepted']);
  return {
    task,
    story,
    modules,
    principles,
    dependencies: {
      upstream: upstreamRows.map((r) => ({
        id: String(r.id), title: String(r.title), status: String(r.status), done: DONE.has(String(r.status)),
      })),
      downstream: downstreamRows.map((r) => ({
        id: String(r.id), title: String(r.title), status: String(r.status),
      })),
    },
    siblings: siblingRows.map((r) => ({
      id: String(r.id), title: String(r.title), status: String(r.status),
    })),
    ledger,
  };
}
