/**
 * 人类可读的实体 ID 生成（服务端）
 *
 * 背景：历史数据里故事 ID 混用两种形态 —— 早期人工/迁移导入的 `US-015`（6 字符，
 * 卡片窄列可完整显示）与服务端 nanoid 生成的 21 字符随机串。后者在故事地图 200px
 * 窄列里必然截断（曾遮挡状态徽章，见 fix: 故事卡长 ID 遮挡），且不可读、不可引用。
 *
 * 统一策略：服务端新建实体一律生成 `US-001` / `TASK-001` 形态的短 ID。
 * 序号由 PostgreSQL 序列原子分配（并发安全，杜绝「读最大值 + 1」的竞态）——
 * 注意序号是全局单调的，不按产品重置，避免不同产品间 ID 冲突（主键全局唯一）。
 */

import { sql } from 'drizzle-orm';
import { ensureDb } from '@x-cartographer/db';
/** 受支持的短 ID 前缀（前缀 → 序列名） */
const ID_SEQUENCES = {
  story: { prefix: 'US', sequence: 'user_story_id_seq' },
  devTask: { prefix: 'TASK', sequence: 'dev_task_id_seq' },
} as const;

export type ShortIdKind = keyof typeof ID_SEQUENCES;

/**
 * 生成短 ID（`<PREFIX>-<3 位以上补零序号>`）。
 *
 * 序列不存在时按需创建（幂等），确保新增实体无需额外迁移步骤即可工作。
 * 序号超过 999 时自然增长为 4 位（`US-1000`），不截断。
 */
export async function generateShortId(kind: ShortIdKind): Promise<string> {
  const { prefix, sequence } = ID_SEQUENCES[kind];
  const db = await ensureDb();
  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${sequence}`));
  const result = await db.execute<{ n: string }>(
    sql.raw(`SELECT nextval('${sequence}')::text AS n`)
  );
  const n = Number((result as unknown as { rows: Array<{ n: string }> }).rows[0].n);
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

/**
 * 把序列推进到不低于给定值（迁移/初始化用）。
 * 用于在新序列建立后，跳过历史数据已占用的号段，避免撞已有 ID。
 */
export async function bumpSequenceTo(kind: ShortIdKind, atLeast: number): Promise<void> {
  const { sequence } = ID_SEQUENCES[kind];
  const db = await ensureDb();
  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${sequence}`));
  await db.execute(
    sql.raw(`SELECT setval('${sequence}', GREATEST((SELECT last_value FROM ${sequence}), ${atLeast}))`)
  );
}
