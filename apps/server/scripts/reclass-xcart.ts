import { sql } from 'drizzle-orm';
import { ensureDb, type DbInstance } from '@x-cartographer/db';

process.env.XPR_DB_DIR = '/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/server/data/pglite';
const db: DbInstance = await ensureDb();
const q = async (s: string): Promise<any[]> => { const r: any = await db.execute(sql.raw(s)); return r.rows; };
const PID = '69hKGAjvxjf6QVQu6DtZx';

// ── 1. 活动改名 + 新增（幂等：按名字 upsert）──
const acts: Array<[string, string, string]> = [
  ['管理产品', '定义产品', '建立并管理产品/项目上下文'],
  ['组织故事地图', '组织故事地图', '以故事地图表达需求全貌'],
  ['规划发布', '规划发布', '将故事切片排入版本'],
  ['拆解任务', '拆解执行', '将故事落成任务并跟踪交付'],
  ['跟踪执行', '拆解执行', '(合并到拆解执行)'],
];
for (const [oldName, newName, desc] of acts) {
  if (oldName !== newName) {
    await db.execute(sql.raw(`UPDATE user_activities SET name='${newName}', description='${desc}' WHERE product_id='${PID}' AND name='${oldName}'`));
  } else {
    await db.execute(sql.raw(`UPDATE user_activities SET description='${desc}' WHERE product_id='${PID}' AND name='${newName}'`));
  }
}
// 删除将合并的旧活动前先转移其故事（拆解任务/跟踪执行 → 拆解执行）
// 注意上面 UPDATE 已把两个都改成'拆解执行' → 会重名。改策略：直接删一个。
const dup = await q(`SELECT id, name FROM user_activities WHERE product_id='${PID}' AND name='拆解执行' ORDER BY "order"`);
if (dup.length > 1) {
  // 保留 order 靠前的，把另一个的故事转移后删除
  const keep = dup[0], drop = dup[1];
  await db.execute(sql.raw(`UPDATE user_stories SET activity_id='${keep.id}' WHERE activity_id='${drop.id}'`));
  await db.execute(sql.raw(`DELETE FROM user_activities WHERE id='${drop.id}'`));
}
// 治理架构（新增或复用）
let gov = await q(`SELECT id FROM user_activities WHERE product_id='${PID}' AND name='治理架构'`);
if (!gov.length) {
  const maxOrder = await q(`SELECT COALESCE(MAX("order"),0)::int AS m FROM user_activities WHERE product_id='${PID}'`);
  const gid = 'UA-69hKGA-6';
  await db.execute(sql.raw(`INSERT INTO user_activities (id, product_id, name, description, "order", created_at, updated_at) VALUES ('${gid}', '${PID}', '治理架构', '技术决策与工程规范沉淀', ${maxOrder[0].m + 1}, now(), now()) ON CONFLICT (id) DO NOTHING`));
  gov = await q(`SELECT id FROM user_activities WHERE product_id='${PID}' AND name='治理架构'`);
}
// 重排 order：定义产品1 组织故事地图2 规划发布3 拆解执行4 治理架构5
const ord = await q(`SELECT id, name FROM user_activities WHERE product_id='${PID}'`);
const orderMap: Record<string, number> = { '定义产品': 1, '组织故事地图': 2, '规划发布': 3, '拆解执行': 4, '治理架构': 5 };
for (const a of ord) {
  const o = orderMap[a.name as string];
  if (o) await db.execute(sql.raw(`UPDATE user_activities SET "order"=${o} WHERE id='${a.id}'`));
}
console.log('活动骨架:', ord.map((a: any) => `${a.name}`).join(' / '));

// ── 2. UserTask 骨架（每活动 2-4 个用户任务步骤）──
const uts: Array<[string, string, string, string]> = [
  // [id, activity name, task name, order]
  ['UT-69h-101', '定义产品', '管理产品与项目', '1'],
  ['UT-69h-102', '定义产品', '管理数据资产', '2'],
  ['UT-69h-201', '组织故事地图', '浏览故事地图', '1'],
  ['UT-69h-202', '组织故事地图', '组织故事卡片', '2'],
  ['UT-69h-203', '组织故事地图', '筛选与聚焦', '3'],
  ['UT-69h-204', '组织故事地图', '对齐方法论与文档', '4'],
  ['UT-69h-301', '规划发布', '管理版本里程碑', '1'],
  ['UT-69h-302', '规划发布', '排期故事入版本', '2'],
  ['UT-69h-303', '规划发布', '查看路线图', '3'],
  ['UT-69h-401', '拆解执行', '拆解任务', '1'],
  ['UT-69h-402', '拆解执行', '跟踪任务状态', '2'],
  ['UT-69h-403', '拆解执行', '分析依赖与统计', '3'],
  ['UT-69h-501', '治理架构', '沉淀技术决策(ADR)', '1'],
  ['UT-69h-502', '治理架构', '维护模块归属', '2'],
  ['UT-69h-503', '治理架构', '约束 Agent 纪律', '3'],
];
const actId = async (name: string): Promise<string> => (await q(`SELECT id FROM user_activities WHERE product_id='${PID}' AND name='${name}'`))[0].id;
for (const [id, act, name, order] of uts) {
  const aid = await actId(act);
  await db.execute(sql.raw(`INSERT INTO user_tasks (id, activity_id, name, "order", created_at, updated_at)
    VALUES ('${id}', '${aid}', '${name}', ${order}, now(), now())
    ON CONFLICT (id) DO UPDATE SET activity_id=EXCLUDED.activity_id, name=EXCLUDED.name, "order"=EXCLUDED."order", updated_at=now()`));
}
console.log('UserTask 骨架: 15 个 upsert 完成');

// ── 3. story 重分类 ──
import fs from 'fs';
const M: Array<[string, string, string]> = JSON.parse(fs.readFileSync('/tmp/reclass-map.json', 'utf8'));
const stories = await q(`SELECT s.id, s.title FROM user_stories s JOIN user_activities a ON a.id = s.activity_id WHERE a.product_id='${PID}'`);
let n = 0;
const utId = async (act: string, task: string): Promise<string> => {
  const aid = await actId(act);
  const r = await q(`SELECT id FROM user_tasks WHERE activity_id='${aid}' AND name='${task}'`);
  return r[0].id;
};
for (const s of stories) {
  const hit = M.find(([frag]) => (s.title as string).includes(frag));
  if (!hit) { console.log('  [skip 无映射]', s.title); continue; }
  const [, act, task] = hit;
  const aid = await actId(act);
  const uid = await utId(act, task);
  await db.execute(sql.raw(`UPDATE user_stories SET activity_id='${aid}', user_task_id='${uid}' WHERE id='${s.id}'`));
  n++;
}
console.log(`story 重分类: ${n}/${stories.length}`);

// ── 4. 后置断言 ──
const chk = await q(`SELECT a.name AS act, count(s.id)::int AS n FROM user_activities a LEFT JOIN user_stories s ON s.activity_id = a.id WHERE a.product_id='${PID}' GROUP BY a.name, a."order" ORDER BY a."order"`);
console.log('分布:', chk.map((r: any) => `${r.act}=${r.n}`).join(' '));
const orphan = await q(`SELECT count(*)::int AS n FROM user_stories WHERE activity_id IS NULL AND id IN (SELECT s.id FROM user_stories s JOIN user_activities a ON a.id=s.activity_id WHERE a.product_id='${PID}')`);
const utOrphan = await q(`SELECT count(*)::int AS n FROM user_stories WHERE user_task_id IS NULL`);
console.log(`orphan activity_id=${orphan[0].n} user_task_id=${utOrphan[0].n}`);
process.exit(0);
