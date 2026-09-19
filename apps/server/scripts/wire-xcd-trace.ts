#!/usr/bin/env bun
/**
 * X-Cartographer-Dev 追溯链接线：故事 affected_modules + 任务 moduleId 补数据
 * （一次性工具，规则表驱动；dry-run 先行，人工核对后执行）
 *
 * 背景：模块目录（15 模块）已落库，但 57 故事 / 201 任务的模块标注全空——
 * 追溯链（trace）的输入为零。本脚本按**高置信规则**补数据：
 * 每条规则 = 模块 id + 关键词组（标题匹配，全部小写包含判断）。
 * 不确定的不标——宁可缺失，不编造归属（域模型「宁可缺失，不撒谎」）。
 *
 * 幂等：PATCH 覆盖写，可重跑。
 */
const SERVER = process.argv.find((a) => a.startsWith('--server'))?.split('=')[1] ?? 'http://localhost:8787';
const DRY_RUN = process.argv.includes('--dry-run');
const PID = '69hKGAjvxjf6QVQu6DtZx';

/** 规则表：关键词（小写包含）→ 模块。顺序即优先级，先命中先得。 */
const RULES: Array<{ moduleId: string; keywords: string[] }> = [
  { moduleId: 'web-story-map', keywords: ['故事地图', '地图重构', 'patton', '拖拽排序', '切片线', '泳道', '骨架行', '深度行'] },
  { moduleId: 'web-tasks', keywords: ['任务列', '任务看板', '任务详情', '批量编辑', '任务依赖', '依赖图', 'topological', '拓扑'] },
  { moduleId: 'web-roadmap', keywords: ['roadmap', '版本泳道', '发布视图', '里程碑视图', '可预测性'] },
  { moduleId: 'web-modules', keywords: ['模块目录', '模块列表', '模块依赖图'] },
  { moduleId: 'web-journeys', keywords: ['旅程视图', '活动管理', 'user-task', '用户任务列'] },
  { moduleId: 'web-browser', keywords: ['数据浏览', '工作台', 'onboarding', '引导'] },
  { moduleId: 'web-core', keywords: ['路由树', 'tanstack', 'api 客户端', 'ui 组件', '暗色主题', '多语言'] },
  { moduleId: 'api-routes', keywords: ['rest', 'api 端点', '深树接口', 'honog', '路由 rename', '全路由', 'crud'] },
  { moduleId: 'api-middleware', keywords: ['auth', 'api token', 'spa 静态'] },
  { moduleId: 'domain-layer', keywords: ['分类器', 'constraint-impact', 'module-refs', 'schema-health'] },
  { moduleId: 'persistence', keywords: ['drizzle', 'pglite', '迁移 000', 'schema 迁移', 'orm', '短 id', 'short-id'] },
  { moduleId: 'contract', keywords: ['shared 类型', '契约', 'zod schema', '类型 rename'] },
  { moduleId: 'cli', keywords: ['cli 命令', 'xcart', 'context export', 'cli rename'] },
  { moduleId: 'migration-tooling', keywords: ['数据迁移脚本', 'migrate-story-map', 'sync-dev-db', '备份还原', 'apply-usertask'] },
  { moduleId: 'delivery', keywords: ['docker', 'ci ', 'github actions', 'workflow', 'compose', 'runner', '部署'] },
];

const STORY_MODULE_EXTRA: Record<string, string[]> = {
  'US-015': ['web-browser'],          // 创建与配置产品 → 产品选择界面
  '2TkPTEtG0KZTh4NoxMUo6': ['web-browser'], // 切换当前产品
  'US-016': ['web-browser'],          // 保存与加载数据
  'eiLlYCYk86je-Jrkl-6Wy': ['api-routes', 'web-browser'], // 导入导出
  'US-012': ['web-tasks'],            // 登记研发任务
  'US-014': ['web-tasks', 'cli'],     // 导出任务清单
  'US-017': ['web-tasks'],            // 认领与推进
  'DPJMk8vM_rb2Av9PJh4kl': ['web-tasks'],
  'US-034': ['web-tasks'],            // 批量管理
  'US-038': ['web-tasks'],            // 跨产品待办
  'US-035': ['web-tasks'],            // 进度统计
  'iUXr0eSGFrc9xXJXgW0YS': ['web-roadmap'],
  'US-039': ['web-roadmap'],          // 管理版本
  'US-041': ['web-roadmap'],          // 发布视图
  'baMSRGsUGD-CYFZfuvv3D': ['web-roadmap'],
  'US-019': ['web-browser'],          // 使用文档
  'US-020': ['web-browser'],
  'US-044': ['api-middleware', 'cli'], // API Token
  'US-046': ['cli'],                  // CLI 入口
  'US-047': ['cli'],                  // 上下文导出
  'US-000': ['delivery'],             // 基础设施脚手架
  'US-021': ['persistence'],          // 数据库选型
  'US-022': ['persistence'],          // ORM 选型
  'US-004': ['web-story-map'],        // 创建与编辑故事
  'US-006': ['web-story-map'],        // 批量编辑
  'US-009': ['web-story-map'],
  'US-008': ['web-story-map'],        // 拖拽排序
  'livRZhST9D9feFXLYsS7c': ['web-story-map'],
  'US-010': ['web-story-map'],        // 检索筛选
  'US-042': ['web-story-map'],
  'US-007': ['web-story-map'],        // 浏览地图全貌
  'gMlVIegfHZV4wyqYre0nm': ['web-story-map'],
  'sXCmRZo_JxcZxWLJanTL2': ['web-story-map'],
  'LzeFkWQJcb9C4hBL0BtcT': ['web-story-map'],
  '-w1Be5LWc79dFv_iDVyNZ': ['web-story-map'], // 管理故事状态
  'ISi7IuVpXJAoJoFdBh1kO': ['web-story-map'],
  '2Tcdd0D-uOz-DL9bo8RnU': ['web-modules'],   // 依赖图
  'mB3EAa0eeGdb53JSgENfC': ['web-modules'],   // 模块归属
  'a3kpWpAYtMIRyVALx-JR7': ['persistence', 'contract', 'api-routes', 'cli', 'web-story-map', 'migration-tooling'], // 重设计迁移
  'kvkwxNnouah8rXMMwUReZ': ['contract'],      // 方法论语义
  's9Qu7Zrt4BcpZRwS1zQOc': ['api-routes'],    // ADR 建模
  'w-HTN_ONxKJDaRFmdVtjC': ['api-routes'],
  'RecaGMWNlb_RTwPIvuswL': ['cli'],
  'XmV-q2eSAblZwTdb0knMF': ['web-browser'],
  'zK1JY2M7UesSoRCqGjypU': ['api-routes'],
  'HTHnFx9UEHzG_wvanjgfJ': ['web-modules'],
  'wY_zzmLO8tlRnyK5dbrft': ['cli'],
  'WR9VCoKVmgBuGMqBztJV-': ['api-routes'],
  'Ifc9cyGxHQswuu3nTy1wj': ['cli'],
  'US-040': ['web-story-map'],        // 排入版本（地图切片线动作）
};
interface TreeStory {
  id: string;
  title: string;
  affected_modules?: string[] | null;
  dev_tasks: Array<{ id: string; title: string; module_id?: string | null }>;
}

interface Tree {
  user_activities: Array<{ stories: TreeStory[] }>;
}

function matchRules(text: string): string[] {
  const t = text.toLowerCase();
  const hits: string[] = [];
  for (const rule of RULES) {
    if (rule.keywords.some((k) => t.includes(k.toLowerCase())) && !hits.includes(rule.moduleId)) {
      hits.push(rule.moduleId);
    }
  }
  return hits;
}

async function api(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 150)}`);
  return text ? JSON.parse(text) : undefined;
}

async function main(): Promise<void> {
  console.log(`=== XCD 追溯链接线${DRY_RUN ? '（DRY-RUN）' : ''} → ${SERVER} ===\n`);
  const tree = (await api(`/api/products/${PID}`)) as Tree;
  const stories = tree.user_activities.flatMap((a) => a.stories);

  let sPatched = 0, tPatched = 0, unmatched = 0;
  for (const s of stories) {
    // 故事归属 = 特判表 ∪ 关键词规则（标题）
    const extra = STORY_MODULE_EXTRA[s.id] ?? [];
    const ruleHit = matchRules(s.title);
    const mods = [...new Set([...extra, ...ruleHit])];
    if (mods.length > 0) {
      if (!DRY_RUN) {
        await api(`/api/stories/${s.id}`, 'PATCH', { affectedModules: mods });
      }
      sPatched++;
    } else {
      unmatched++;
      console.log(`  ? 故事无归属: ${s.id}「${s.title.slice(0, 30)}」`);
    }

    // 任务归属：继承故事归属（任务属于哪个模块 ≈ 它服务的故事的模块），仅当任务自身无锚
    for (const t of s.dev_tasks ?? []) {
      if (t.module_id) continue;
      const taskMods = mods.length ? mods.slice(0, 1) : matchRules(t.title); // 任务取第一优先
      if (taskMods.length === 0) continue;
      if (!DRY_RUN) {
        await api(`/api/dev-tasks/${t.id}`, 'PATCH', { moduleId: taskMods[0] });
      }
      tPatched++;
    }
  }

  console.log(`\n故事标注 ${sPatched}，任务锚定 ${tPatched}，无归属故事 ${unmatched}`);
  console.log(DRY_RUN ? '[DRY-RUN 完成未写入]' : 'WIRING PASS');
  process.exit(0);
}

main();