#!/usr/bin/env bun
/**
 * UserTask 补层落库（通用脚本）
 *
 * 输入：一份 plan JSON（裁决产物），格式见 UsertaskPlan 类型。
 * provenance 固定为 human_asserted —— plan 由 Agent 归纳成草稿、经**人裁决**后落库，
 * 属"裁决过的意图"而非 Agent 推断（domain-model.md §3 来源标记不可混）。
 *
 * 用法：
 *   bun scripts/apply-usertask-plan.ts <plan.json> [--dry-run] [--server <url>]
 *
 * plan JSON 结构：
 *   {
 *     "product_id": "69hKGAjvxjf6QVQu6DtZx",
 *     "activities": {
 *       "管理产品": [
 *         { "name": "创建与配置产品", "desc": "...", "stories": ["US-015"] }
 *       ]
 *     }
 *   }
 *
 * 幂等：UserTask 按 name 在活动内去重；故事挂载为覆盖写。可安全重跑。
 */
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const serverIdx = args.indexOf('--server');
const SERVER = serverIdx >= 0 ? (args[serverIdx + 1] ?? 'http://localhost:8787') : 'http://localhost:8787';

const planPath = args.find((a) => !a.startsWith('--') && a !== SERVER);
if (!planPath) {
  console.error('用法: bun scripts/apply-usertask-plan.ts <plan.json> [--dry-run] [--server <url>]');
  process.exit(1);
}

interface UsertaskPlan {
  product_id: string;
  activities: Record<string, Array<{ name: string; desc: string; stories: string[] }>>;
}

const raw = await Bun.file(planPath).json() as UsertaskPlan;
if (!raw.product_id || !raw.activities) {
  console.error('[abort] plan JSON 缺少 product_id 或 activities');
  process.exit(1);
}
const PRODUCT = raw.product_id;
const PLAN = raw.activities;

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function main(): Promise<void> {
  console.log(`=== UserTask 补层落库${DRY_RUN ? '（DRY-RUN）' : ''} → ${SERVER} ===`);

  const tree = await api<{ user_activities: Array<{ id: string; name: string; user_tasks?: Array<{ id: string; name: string }>; stories: Array<{ id: string; title: string }> }> }>(
    `/api/products/${PRODUCT}`
  );
  const actByName = new Map(tree.user_activities.map((a) => [a.name, a]));

  // 前置断言：活动齐全 + 故事齐全
  const wanted = Object.keys(PLAN);
  const missingActs = wanted.filter((n) => !actByName.has(n));
  if (missingActs.length) { console.error(`[abort] 缺少活动: ${missingActs.join(', ')}`); process.exit(1); }

  const allStoryIds = new Set(tree.user_activities.flatMap((a) => a.stories.map((s) => s.id)));
  const planned = Object.values(PLAN).flat().flatMap((t) => t.stories);
  const missingStories = planned.filter((id) => !allStoryIds.has(id));
  if (missingStories.length) { console.error(`[abort] 故事不存在: ${missingStories.join(', ')}`); process.exit(1); }
  const dupes = planned.filter((id, i) => planned.indexOf(id) !== i);
  if (dupes.length) { console.error(`[abort] 故事重复归类: ${dupes.join(', ')}`); process.exit(1); }

  const totalTasks = Object.values(PLAN).flat().length;
  console.log(`[pre] 活动=${wanted.length} 步骤=${totalTasks} 故事=${planned.length}（去重后 ${new Set(planned).size}）`);

  let created = 0, attached = 0;
  for (const [actName, tasks] of Object.entries(PLAN)) {
    const act = actByName.get(actName)!;
    const existing = new Map((act.user_tasks ?? []).map((t) => [t.name, t.id]));
    console.log(`--- ${actName}`);
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]!;
      let utId = existing.get(t.name);
      if (!utId) {
        if (DRY_RUN) { console.log(`  [dry] 创建步骤「${t.name}」(order=${i})`); utId = `DRY-${i}`; }
        else {
          const res = await api<{ id: string }>('/api/user-tasks', 'POST', {
            activityId: act.id,
            name: t.name,
            description: t.desc,
            order: i,
            provenance: 'human_asserted',
          });
          utId = res.id;
        }
        created++;
      }
      for (const sid of t.stories) {
        if (!DRY_RUN) {
          await api(`/api/stories/${sid}`, 'PATCH', { userTaskId: utId });
        }
        attached++;
      }
      console.log(`  ${utId} 「${t.name}」← ${t.stories.length} 故事`);
    }
  }

  console.log(`\n创建步骤 ${created}，挂载故事 ${attached}`);

  if (!DRY_RUN) {
    // 后置断言
    const after = await api<{ user_activities: Array<{ name: string; user_tasks?: Array<{ id: string; name: string }>; stories: Array<{ id: string; user_task_id?: string | null }> }> }>(
      `/api/products/${PRODUCT}`
    );
    const utCount = after.user_activities.reduce((s, a) => s + (a.user_tasks?.length ?? 0), 0);
    const assignedStories = after.user_activities.flatMap((a) => a.stories).filter((s) => s.user_task_id).length;
    const totalStories = after.user_activities.flatMap((a) => a.stories).length;
    console.log(`[post] UserTask=${utCount} 已挂故事=${assignedStories}/${totalStories}`);
    if (utCount !== totalTasks) { console.error(`[assert-fail] 步骤数不符（期望 ${totalTasks}）`); process.exit(1); }
    if (assignedStories !== planned.length) { console.error(`[assert-fail] 挂载数不符（期望 ${planned.length}）`); process.exit(1); }
    console.log('USER-TASK PLAN APPLIED');
  } else {
    console.log('[DRY-RUN 完成未写入]');
  }
  process.exit(0);
}

main();
