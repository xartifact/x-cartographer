#!/usr/bin/env bun
/**
 * 跨活动故事迁移补丁：plan 里每个故事 PATCH activityId → 新活动 + userTaskId → 新步骤
 *
 * 背景：apply-usertask-plan.ts 只 PATCH userTaskId，不改 activityId。
 * 跨活动骨架重建时故事仍挂在旧活动（深树按 activity 分组渲染），
 * 新活动列下 stories 恒为 0。本脚本按 plan 的 活动名→activity_id 映射补迁。
 *
 * 幂等：PATCH 同值，可重跑。
 */
const args = process.argv.slice(2);
const serverIdx = args.indexOf('--server');
const SERVER = serverIdx >= 0 ? args[serverIdx + 1] : 'http://localhost:8787';
const planPath = args.find((a) => !a.startsWith('--') && a !== SERVER);
if (!planPath) {
  console.error('用法: bun scripts/migrate-plan-stories.ts <plan.json> --server <url>');
  process.exit(1);
}

interface Plan {
  product_id: string;
  activities: Record<string, Array<{ name: string; stories: string[] }>>;
}

const plan = (await Bun.file(planPath).json()) as Plan;
const PID = plan.product_id;

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 150)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

const tree = await api<{ user_activities: Array<{ id: string; name: string; user_tasks?: Array<{ id: string; name: string }> }> }>(
  `/api/products/${PID}`
);
const actByName = new Map(tree.user_activities.map((a) => [a.name, a]));
const utByName = new Map<string, string>();
for (const a of tree.user_activities) {
  for (const ut of a.user_tasks ?? []) utByName.set(`${a.name}/${ut.name}`, ut.id);
}

let moved = 0, skipped = 0;
for (const [actName, groups] of Object.entries(plan.activities)) {
  const act = actByName.get(actName);
  if (!act) {
    console.error(`[abort] 活动「${actName}」不存在`);
    process.exit(1);
  }
  for (const group of groups) {
    const utId = utByName.get(`${actName}/${group.name}`);
    if (!utId) {
      console.error(`[abort] 步骤「${actName}/${group.name}」不存在`);
      process.exit(1);
    }
    for (const sid of group.stories) {
      const story = (await api<{ activity_id: string; user_task_id: string | null }>(`/api/stories/${sid}`)) as never as {
        activity_id: string;
        user_task_id: string | null;
      };
      if (story.activity_id === act.id && story.user_task_id === utId) {
        skipped++;
        continue;
      }
      await api(`/api/stories/${sid}`, 'PATCH', { activityId: act.id, userTaskId: utId });
      moved++;
    }
  }
}

// 后置断言：plan 内全部故事都在目标活动下
const after = await api<{ user_activities: Array<{ id: string; name: string; stories: Array<{ id: string; user_task_id: string | null }> }> }>(
  `/api/products/${PID}`
);
const storyLocation = new Map<string, { actId: string; utId: string | null }>();
for (const a of after.user_activities) {
  for (const s of a.stories) storyLocation.set(s.id, { actId: a.id, utId: s.user_task_id });
}
const failures: string[] = [];
for (const [actName, groups] of Object.entries(plan.activities)) {
  const act = actByName.get(actName)!;
  for (const group of groups) {
    const utId = utByName.get(`${actName}/${group.name}`);
    for (const sid of group.stories) {
      const loc = storyLocation.get(sid);
      if (!loc) failures.push(`${sid} 不在树中`);
      else if (loc.actId !== act.id) failures.push(`${sid} 仍在活动 ${loc.actId}（期望 ${act.name}）`);
      else if (loc.utId !== utId) failures.push(`${sid} 挂在错误步骤`);
    }
  }
}

console.log(`迁移 ${moved}，幂等跳过 ${skipped}`);
if (failures.length) {
  console.error(`\n[FAIL]\n  ${failures.slice(0, 10).join('\n  ')}`);
  process.exit(1);
}
console.log('MIGRATE PASS');
process.exit(0);