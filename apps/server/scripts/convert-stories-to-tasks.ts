#!/usr/bin/env bun
/**
 * 工程治理类 Story → DevTask 转换（一次性工具，需人工确认后执行删除）
 *
 * 背景（docs/design/domain-model.md §2.5）：
 * 工程治理类 Story（重构/技术债/架构一致性）**不是用户故事**——用户不关心
 * "Service 层一致性"。它们应作为 DevTask 挂在 SystemModule 上。
 *
 * 两步（本脚本只做第一步）：
 *   1. Story → DevTask（保留 story 作为回溯锚，user_task_id 指向新建的 task）
 *   2. **人工确认后**删除 Story（另一步，本脚本不做）
 *
 * 设计取舍：第一步不删 story，是为了让第二步可验证——
 * 若转换有误，story 还在；确认无误后再删。
 *
 * 幂等：按 `tags` 含 `converted-from-story:<storyId>` 去重。可安全重跑。
 *
 * 用法：
 *   bun scripts/convert-stories-to-tasks.ts <plan.json> [--dry-run] [--server <url>]
 *
 * plan JSON 结构：
 *   {
 *     "product_id": "...",
 *     "conversions": [
 *       { "story_id": "wlyhT...", "module_id": "gateway", "title": "...", "reason": "..." }
 *     ]
 *   }
 */
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const serverIdx = args.indexOf('--server');
const SERVER = serverIdx >= 0 ? (args[serverIdx + 1] ?? 'http://localhost:8787') : 'http://localhost:8787';

const planPath = args.find((a) => !a.startsWith('--') && a !== SERVER);
if (!planPath) {
  console.error('用法: bun scripts/convert-stories-to-tasks.ts <plan.json> [--dry-run] [--server <url>]');
  process.exit(1);
}

interface ConversionPlan {
  product_id: string;
  conversions: Array<{
    story_id: string;
    module_id: string;
    title: string;
    reason: string;
  }>;
}

const raw = await Bun.file(planPath).json() as ConversionPlan;
if (!raw.product_id || !Array.isArray(raw.conversions)) {
  console.error('[abort] plan JSON 缺少 product_id 或 conversions');
  process.exit(1);
}

const PRODUCT = raw.product_id;
const CONVERSIONS = raw.conversions;

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

interface Tree {
  user_activities: Array<{
    id: string;
    name: string;
    user_tasks?: Array<{ id: string; name: string }>;
    stories: Array<{ id: string; title: string; status: string; dev_tasks: Array<{ id: string; title: string; tags: string[] }> }>;
  }>;
}

async function main(): Promise<void> {
  console.log(`=== 工程治理类 Story → DevTask${DRY_RUN ? '（DRY-RUN）' : ''} → ${SERVER} ===`);

  const tree = await api<Tree>(`/api/products/${PRODUCT}`);
  const storyById = new Map<string, Tree['user_activities'][number]['stories'][number]>();
  for (const a of tree.user_activities) for (const s of a.stories) storyById.set(s.id, s);

  const modules = await api<Array<{ id: string }>>(`/api/system-modules?productId=${PRODUCT}`);
  const moduleIds = new Set(modules.map((m) => m.id));

  // 前置断言
  const missingStories = CONVERSIONS.filter((c) => !storyById.has(c.story_id)).map((c) => c.story_id);
  if (missingStories.length) { console.error(`[abort] story 不存在: ${missingStories.join(', ')}`); process.exit(1); }
  const missingModules = CONVERSIONS.filter((c) => !moduleIds.has(c.module_id)).map((c) => c.module_id);
  if (missingModules.length) { console.error(`[abort] module 不存在: ${[...new Set(missingModules)].join(', ')}`); process.exit(1); }

  const MARK = (sid: string) => `converted-from-story:${sid}`;
  let created = 0, skipped = 0;

  for (const c of CONVERSIONS) {
    const story = storyById.get(c.story_id)!;
    const already = story.dev_tasks.some((t) => (t.tags ?? []).includes(MARK(c.story_id)));
    if (already) { console.log(`  [skip] ${c.story_id} 已转换`); skipped++; continue; }

    if (DRY_RUN) {
      console.log(`  [dry] ${c.story_id} → DevTask「${c.title}」挂 ${c.module_id}`);
      created++;
      continue;
    }
    await api('/api/dev-tasks', 'POST', {
      storyId: c.story_id,
      productId: PRODUCT,
      moduleId: c.module_id,
      title: c.title,
      description: `[由工程治理类 Story ${c.story_id} 转换] ${c.reason}`,
      priority: 'P2',
      estimation: 0,
      dependencies: [],
      tags: ['architecture-enabler', MARK(c.story_id)],
    });
    console.log(`  ✓ ${c.story_id} → DevTask「${c.title}」挂 ${c.module_id}`);
    created++;
  }

  console.log(`\n创建 DevTask ${created}，跳过 ${skipped}`);

  if (!DRY_RUN) {
    console.log('\n下一步（需人工确认）：');
    console.log('  1. 核对新建 DevTask 的内容与归属');
    console.log('  2. 确认无误后删除对应 Story（本脚本不做）');
    console.log('     删除前请确认：story 下原有的 dev_tasks 已全部迁移或确认为冗余');
  } else {
    console.log('[DRY-RUN 完成未写入]');
  }
  process.exit(0);
}

main();
