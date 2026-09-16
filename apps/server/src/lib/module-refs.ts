/**
 * 模块引用校验（apps/server/src/lib/module-refs.ts）
 *
 * 存在问题（docs/design/domain-model.md §6.4）：`affected_modules` / `module_ids`
 * 注释声称"引用 SystemModule.id"，但此前无任何校验——因为模块根本没有表，
 * 无从校验。0006 落表后才有 referent，本模块补上这道校验。
 *
 * 校验语义（重要，勿扩大）：
 * - 只做**存在性**检查（引用的 slug 在该产品的模块目录中存在吗）
 * - **不做业务拦截**——技术宪法 §3.5 定调："纯粹是信息，不产生任何服务端裁决"。
 *   标注了不存在的模块是"目录没维护好"，不是"任务不该流转"。
 *   故默认策略是**告警不阻断**（返回 warning，请求照常成功）。
 */
import { SystemModuleRepository } from '@x-cartographer/db';
import { userActivities } from '@x-cartographer/db';
import { ensureDb } from '@x-cartographer/db';
import { eq } from 'drizzle-orm';

const moduleRepo = new SystemModuleRepository();

/** 由 activity id 解析所属产品（模块目录按产品隔离） */
export async function productIdOfActivity(activityId: string): Promise<string | null> {
  const db = await ensureDb();
  const row = await db.query.userActivities.findFirst({
    where: eq(userActivities.id, activityId),
  });
  return row?.productId ?? null;
}

/**
 * 校验模块引用。返回不存在的 slug 列表（空 = 全部有效）。
 *
 * productId 为 null（如 story 未挂活动）时**跳过校验**并返回空——
 * 没有产品上下文就无从判断模块是否有效，此时宁可放过也不误报。
 */
export async function findDanglingModuleRefs(
  productId: string | null,
  moduleIds: string[] | undefined
): Promise<string[]> {
  if (!productId || !moduleIds || moduleIds.length === 0) return [];
  return moduleRepo.findMissingIds(productId, moduleIds);
}

/** repository 单例（供路由直接复用，避免重复实例化） */
export function getModuleRepository(): SystemModuleRepository {
  return moduleRepo;
}
