#!/usr/bin/env bun
/**
 * UserTask 补层落库（一次性脚本，裁决后执行）
 *
 * 来源：/tmp/usertask-draft.md —— 由 Agent 从存量 50 个活跃故事归纳，
 * 经用户整体批准后落库，故 provenance = human_asserted（裁决过的意图，
 * 非 Agent 推断——domain-model.md §3 的来源标记不可混）。
 *
 * 幂等：UserTask 按 name 在活动内去重；故事挂载为覆盖写。
 * 用法：bun scripts/apply-usertask-plan.ts [--dry-run] [--server <url>]
 */
const DRY_RUN = process.argv.includes('--dry-run');
/** --server <url>；缺省用本地 gateway */
const serverIdx = process.argv.indexOf('--server');
const SERVER = serverIdx >= 0 ? (process.argv[serverIdx + 1] ?? 'http://localhost:8787') : 'http://localhost:8787';

/** 活动名 → { 步骤名, 描述, 归属故事 id }[] —— 与草稿逐字一致 */
const PLAN: Record<string, Array<{ name: string; desc: string; stories: string[] }>> = {
  '管理产品': [
    { name: '创建与配置产品', desc: '建立产品、设定其元数据与工作区', stories: ['US-015'] },
    { name: '切换当前产品', desc: '在多个产品之间切换工作上下文', stories: ['2TkPTEtG0KZTh4NoxMUo6'] },
    { name: '保存与加载数据', desc: '持久化与恢复产品数据', stories: ['US-016'] },
    { name: '管理导入导出', desc: '数据的导入导出能力（含下线决策）', stories: ['eiLlYCYk86je-Jrkl-6Wy'] },
  ],
  '组织故事地图': [
    { name: '创建与编辑故事', desc: '在地图上新增、修改故事内容', stories: ['US-004', 'US-006', 'US-009'] },
    { name: '调整地图布局', desc: '拖拽排序、纵向深度与优先级表达', stories: ['US-008', 'livRZhST9D9feFXLYsS7c'] },
    { name: '检索与筛选', desc: '按标签/优先级/版本过滤，聚焦特定内容', stories: ['US-010', 'US-042'] },
    { name: '浏览地图全貌', desc: '可视化总览与卡片详情', stories: ['US-007', 'gMlVIegfHZV4wyqYre0nm', 'sXCmRZo_JxcZxWLJanTL2', 'LzeFkWQJcb9C4hBL0BtcT'] },
    { name: '管理故事状态', desc: '状态与优先级展示、取消放弃的故事', stories: ['-w1Be5LWc79dFv_iDVyNZ', 'ISi7IuVpXJAoJoFdBh1kO'] },
    { name: '查看关系与依赖', desc: '依赖图、模块归属等关系视图', stories: ['2Tcdd0D-uOz-DL9bo8RnU', 'mB3EAa0eeGdb53JSgENfC'] },
    { name: '查阅使用文档', desc: '帮助与上手材料', stories: ['US-019', 'US-020'] },
    { name: '对齐方法论与语义', desc: '沉淀地图语义纪律（含 Agent 生成纪律）', stories: ['a3kpWpAYtMIRyVALx-JR7', 'kvkwxNnouah8rXMMwUReZ'] },
    { name: '排入发布', desc: '把故事挂到版本切片线下（地图内的排期动作）', stories: ['US-040'] },
  ],
  '拆解任务': [
    { name: '登记研发任务', desc: '为故事拆解出研发任务并设定优先级与估算', stories: ['US-012'] },
    { name: '导出任务清单', desc: '把任务导出到外部看板工具', stories: ['US-014'] },
  ],
  '跟踪执行': [
    { name: '认领与推进任务', desc: '挑活、认领、推进状态', stories: ['US-017', 'DPJMk8vM_rb2Av9PJh4kl'] },
    { name: '批量管理任务', desc: '批量更新状态、跨产品汇总待办', stories: ['US-034', 'US-038'] },
    { name: '查看进度与统计', desc: '项目进度、数据概览、按版本排期', stories: ['US-035', 'iUXr0eSGFrc9xXJXgW0YS'] },
    { name: '维护技术宪法', desc: 'ADR 的建模、路由、CLI、消费面与 Skill', stories: ['s9Qu7Zrt4BcpZRwS1zQOc', 'w-HTN_ONxKJDaRFmdVtjC', 'RecaGMWNlb_RTwPIvuswL', 'XmV-q2eSAblZwTdb0knMF', 'zK1JY2M7UesSoRCqGjypU', 'HTHnFx9UEHzG_wvanjgfJ', 'wY_zzmLO8tlRnyK5dbrft', 'WR9VCoKVmgBuGMqBztJV-', 'Ifc9cyGxHQswuu3nTy1wj'] },
    { name: '接入外部 Agent', desc: 'API 令牌、CLI 入口、上下文导出', stories: ['US-044', 'US-046', 'US-047'] },
    { name: '搭建基础设施', desc: '脚手架、数据库、ORM 选型', stories: ['US-000', 'US-021', 'US-022'] },
  ],
  '规划发布': [
    { name: '管理版本', desc: '创建与维护版本里程碑', stories: ['US-039'] },
    { name: '查看发布视图', desc: 'Roadmap 泳道与可预测性指标', stories: ['US-041', 'baMSRGsUGD-CYFZfuvv3D'] },
  ],
};

const PRODUCT = '69hKGAjvxjf6QVQu6DtZx';

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
