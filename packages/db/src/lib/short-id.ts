/**
 * 人类可读的实体 ID 生成（服务端）
 *
 * 背景：历史数据里实体 ID 混用三种形态 —— 早期人工/迁移导入的 `US-015`（6 字符，
 * 卡片窄列可完整显示）、服务端 nanoid 生成的 21 字符随机串、以及 `adr_records` 的
 * UUID。后两者在故事地图 200px 窄列里必然截断（曾遮挡状态徽章，见 fix: 故事卡长 ID
 * 遮挡），且不可读、不可引用。
 *
 * 统一策略：全部实体一律生成 `<PREFIX>-<序号>` 形态（如 `US-048`、`TASK-146`）。
 * 序号由 PostgreSQL 序列原子分配（并发安全，杜绝「读最大值 + 1」的竞态）——
 * 序号全局单调，不按产品重置，避免不同产品间 ID 冲突（主键全局唯一）。
 *
 * 迁移脚本（apps/server/scripts/rename-entity-ids.ts）复用此处的 ID_SPECS
 * 声明，保证生成规则与存量重写规则永不漂移。
 */

import { sql } from 'drizzle-orm';
import { ensureDb, rowsOf } from '../db/client';

/**
 * 实体 ID 规格：前缀、序列表、所在表、以及指向该实体的外键列（存量重写用）。
 *
 * `refs` 列出所有引用该实体主键的位置，含 jsonb 数组列（如 dev_tasks.dependencies
 * 是任务 DAG 的边，存的是任务 ID 数组）。重写时必须同步，否则留下悬空引用。
 */
export const ID_SPECS = {
  product: {
    prefix: 'PROD',
    sequence: 'product_id_seq',
    table: 'products',
    refs: [
      { table: 'user_activities', column: 'product_id', kind: 'column' },
      { table: 'milestones', column: 'product_id', kind: 'column' },
      { table: 'adr_records', column: 'product_id', kind: 'column' },
      { table: '_legacy_user_journeys', column: 'project_id', kind: 'column' },
      // 0006/0008 后加的两条 FK——曾缺失致 rename 事务回滚
      // （UPDATE products SET id 被 ON UPDATE 触发的即时 FK 校验阻断）
      { table: 'system_modules', column: 'product_id', kind: 'column' },
      { table: 'dev_tasks', column: 'product_id', kind: 'column' },
    ],
  },
  userActivity: {
    prefix: 'UA',
    sequence: 'user_activity_id_seq',
    table: 'user_activities',
    refs: [
      { table: 'user_tasks', column: 'activity_id', kind: 'column' },
      { table: 'user_stories', column: 'activity_id', kind: 'column' },
    ],
  },
  userTask: {
    prefix: 'UT',
    sequence: 'user_task_id_seq',
    table: 'user_tasks',
    refs: [{ table: 'user_stories', column: 'user_task_id', kind: 'column' }],
  },
  milestone: {
    prefix: 'MS',
    sequence: 'milestone_id_seq',
    table: 'milestones',
    refs: [
      { table: 'user_stories', column: 'milestone_id', kind: 'column' },
      { table: 'adr_records', column: 'milestone_id', kind: 'column' },
    ],
  },
  story: {
    prefix: 'US',
    sequence: 'user_story_id_seq',
    table: 'user_stories',
    refs: [
      { table: 'dev_tasks', column: 'story_id', kind: 'column' },
      { table: 'status_changes', column: 'entity_id', kind: 'column', filter: "entity_type = 'story'" },
    ],
  },
  devTask: {
    prefix: 'TASK',
    sequence: 'dev_task_id_seq',
    table: 'dev_tasks',
    refs: [
      // 任务 DAG：依赖关系存的是任务 ID 数组（jsonb），重写时需逐元素替换
      { table: 'dev_tasks', column: 'dependencies', kind: 'jsonbArray' },
      { table: 'status_changes', column: 'entity_id', kind: 'column', filter: "entity_type = 'task'" },
    ],
  },
  adr: {
    prefix: 'ADR',
    sequence: 'adr_record_id_seq',
    table: 'adr_records',
    refs: [
      { table: 'status_changes', column: 'entity_id', kind: 'column', filter: "entity_type = 'adr'" },
      { table: 'adr_records', column: 'supersedes', kind: 'column' },
    ],
  },
  statusChange: {
    prefix: 'SC',
    sequence: 'status_change_id_seq',
    table: 'status_changes',
    refs: [],
  },
} as const;

export type ShortIdKind = keyof typeof ID_SPECS;

/**
 * 生成短 ID（`<PREFIX>-<3 位以上补零序号>`）。
 *
 * 序列不存在时按需创建（幂等），确保新增实体无需额外迁移步骤即可工作。
 * 序号超过 999 时自然增长为 4 位（`US-1000`），不截断。
 */
export async function generateShortId(kind: ShortIdKind): Promise<string> {
  const { sequence } = ID_SPECS[kind];
  const db = await ensureDb();
  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${sequence}`));
  const result = await db.execute(sql.raw(`SELECT nextval('${sequence}')::text AS n`));
  const n = Number(rowsOf(result)[0]?.n ?? 0);
  return formatShortId(kind, n);
}

/** 按规格拼装 ID（如 ('story', 48) → 'US-048'） */
export function formatShortId(kind: ShortIdKind, n: number): string {
  return `${ID_SPECS[kind].prefix}-${String(n).padStart(3, '0')}`;
}

/** 解析现有 ID 的序号；非本规格形态（nanoid/UUID/旧前缀）返回 null */
export function parseShortId(kind: ShortIdKind, id: string): number | null {
  const m = new RegExp(`^${ID_SPECS[kind].prefix}-(\\d+)$`).exec(id);
  return m ? Number(m[1]) : null;
}

/**
 * 把序列推进到不低于给定值（迁移/初始化用）。
 * 用于在新序列建立后，跳过历史数据已占用的号段，避免撞已有 ID。
 */
export async function bumpSequenceTo(kind: ShortIdKind, atLeast: number): Promise<void> {
  const { sequence } = ID_SPECS[kind];
  const db = await ensureDb();
  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${sequence}`));
  await db.execute(
    sql.raw(`SELECT setval('${sequence}', GREATEST((SELECT last_value FROM ${sequence}), ${atLeast}))`)
  );
}
