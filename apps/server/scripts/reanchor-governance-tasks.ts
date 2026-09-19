#!/usr/bin/env bun
/**
 * 工程治理旧任务迁锚：story 下挂的执行拆解 → 模块锚定（一次性工具）
 *
 * 背景（2026-09-19 用户裁定「迁锚+删」）：x-herald 10 条工程治理 Story 已转换为
 * DevTask（TASK-187~196，挂模块），但各 story 下还挂着 29 条具体的执行拆解任务
 * （时区 Phase 1.1~1.4、测试重构 T1~T6 等）。这些任务有价值，只是挂错了地方。
 *
 * 本脚本把它们 PATCH 为：story_id=null（脱离故事地图）+ module_id=对应模块
 * （与转换产物同模块）。随后人工确认后删除空 story（另一脚本/手动）。
 *
 * 映射来源：story → module 的映射与 x-herald-governance-conversion.json 一致，
 * 旧任务跟随其原 story 的转换产物走。
 *
 * 幂等：PATCH 天然幂等（置同一值），可安全重跑。
 *
 * 用法: bun scripts/reanchor-governance-tasks.ts [--dry-run] [--server <url>]
 */
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const serverIdx = args.indexOf('--server');
const SERVER = serverIdx >= 0 ? (args[serverIdx + 1] ?? 'http://localhost:8787') : 'http://localhost:8787';

/** story → module（与 governance-conversion plan 完全一致） */
const STORY_MODULE: Record<string, string> = {
  wlyhTi8tgXQ6fd2rDCsXS: 'proxy-runtime',
  'AmxA-_BqFLkUNXOwDeT7B': 'observability',
  'ZVM2ps_H5xoIYAM-HPRnE': 'observability',
  kSMezYH7xmmbZvtoRMDbm: 'observability',
  wjnO6pov7N3b6zYp2bO3n: 'engine',
  'TNE8cb6irzppPmrjzZ-_L': 'resilience',
  _dwNNJUatA8vRsrlcshdL: 'engine',
  'dxZLJ0dz5-8-Lm0PcSUX2': 'proxy-runtime',
  '7gqHHG6HMBHMZcptOKnUS': 'shared',
  eLaVv1F8U7REUa8XMckpI: 'agent-extensions',
};

interface Tree {
  user_activities: Array<{
    stories: Array<{
      id: string;
      title: string;
      dev_tasks: Array<{ id: string; title: string; tags: string[]; module_id?: string | null }>;
    }>;
  }>;
}

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

async function main(): Promise<void> {
  console.log(`=== 工程治理旧任务迁锚${DRY_RUN ? '（DRY-RUN）' : ''} → ${SERVER} ===\n`);

  const XH = 'M26_K2UPZuV48B5HfuQiR';
  const tree = await api<Tree>(`/api/products/${XH}`);

  // 前置断言：全部映射的 story 仍存在
  const storyById = new Map(tree.user_activities.flatMap((a) => a.stories.map((s) => [s.id, s])));
  const missing = Object.keys(STORY_MODULE).filter((sid) => !storyById.has(sid));
  if (missing.length) {
    console.error(`[abort] 映射中的 story 不存在: ${missing.join(', ')}`);
    process.exit(1);
  }

  let moved = 0;
  for (const [sid, mid] of Object.entries(STORY_MODULE)) {
    const story = storyById.get(sid)!;
    // 只迁旧任务（无 architecture-enabler tag 的；转换产物已锚定，跳过）
    const oldTasks = story.dev_tasks.filter((t) => !(t.tags ?? []).includes('architecture-enabler'));
    if (oldTasks.length === 0) {
      console.log(`--- ${sid}（${story.title.slice(0, 24)}…）无旧任务`);
      continue;
    }
    console.log(`--- ${sid} → ${mid}（${oldTasks.length} 条）`);
    for (const t of oldTasks) {
      if (t.module_id === mid) {
        console.log(`  [skip] ${t.id} 已锚定 ${mid}`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`  [dry] ${t.id}「${t.title.slice(0, 30)}」→ ${mid}`);
        moved++;
        continue;
      }
      await api(`/api/dev-tasks/${t.id}`, 'PATCH', { storyId: null, moduleId: mid });
      console.log(`  ✓ ${t.id}「${t.title.slice(0, 30)}」→ ${mid}`);
      moved++;
    }
  }

  console.log(`\n迁锚 ${moved} 条`);
  if (!DRY_RUN && moved > 0) {
    // 后置断言：10 条 story 下应只剩 architecture-enabler 转换产物
    const tree2 = await api<Tree>(`/api/products/${XH}`);
    const storyById2 = new Map(tree2.user_activities.flatMap((a) => a.stories.map((s) => [s.id, s])));
    const failures: string[] = [];
    for (const sid of Object.keys(STORY_MODULE)) {
      const s = storyById2.get(sid);
      if (!s) continue;
      const leftover = s.dev_tasks.filter((t) => !(t.tags ?? []).includes('architecture-enabler'));
      if (leftover.length) failures.push(`${sid}: 仍有 ${leftover.length} 条未迁任务`);
    }
    if (failures.length) {
      console.error(`\n[FAIL] 后置断言:\n  ${failures.join('\n  ')}`);
      process.exit(1);
    }
    console.log('后置断言通过：全部旧任务已脱离 story');
  }
  console.log(DRY_RUN ? '[DRY-RUN 完成未写入]' : 'REANCHOR PASS');
  process.exit(0);
}

main();