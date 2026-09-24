import { eq, and, sql } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { devTasks } from '../db/schema/dev-tasks';
import type { CreateDevTaskDTO, UpdateDevTaskDTO } from '@x-cartographer/shared';

/**
 * 状态流转要维护的 started_at / completed_at（由新状态派生 + COALESCE 保序，
 * 单语句完成，不破坏 CAS 原子性——故无需先读旧行）。
 *
 * 两列此前无任何写入路径：唯一写它们的是 `PUT /api/products/full`（CLI 无命令，
 * P5 下 agent 不可达），故生产 593 条任务、472 条 done 全部为空——UI「完成时间」
 * 分支是死代码。语义：
 * - 进入「进行中」组（in_progress / in_review / testing）→ startedAt 首次置位
 *   （COALESCE 保留更早的开始时间：重开不清，活确实开始过）
 * - 进入 done → completedAt = now()
 * - 其余（backlog / todo / cancelled，含从 done 退回）→ completedAt 清空
 *   （不是"已完成"）
 *
 * 直接 backlog→done 只记完成时间、不伪造开始时间（没有证据表明开始过，不猜）。
 */
function statusTimestamps(
  newStatus: string
): { startedAt?: Date | null | ReturnType<typeof sql>; completedAt?: Date | null } {
  if (newStatus === 'done') return { completedAt: new Date() };
  if (newStatus === 'in_progress' || newStatus === 'in_review' || newStatus === 'testing') {
    return { startedAt: sql`coalesce(${devTasks.startedAt}, now())`, completedAt: null };
  }
  // backlog / todo / cancelled：不是"已完成"
  return { completedAt: null };
}

/**
 * 研发任务（DevTask）repository —— 原 TaskRepository 正名。
 */
export class DevTaskRepository {
  async findById(id: string) {
    const db = await ensureDb();
    return db.query.devTasks.findFirst({ where: eq(devTasks.id, id) });
  }

  async findByStoryId(storyId: string) {
    const db = await ensureDb();
    return db.query.devTasks.findMany({
      where: eq(devTasks.storyId, storyId),
    });
  }

  /** 按模块锚定查询（§6.7 方案 B：工程治理类任务脱离 story 后的唯一检索路径） */
  async findByModuleId(moduleId: string) {
    const db = await ensureDb();
    return db.query.devTasks.findMany({
      where: eq(devTasks.moduleId, moduleId),
    });
  }

  /** 全量（跨产品聚合视图用；深树路径看不到脱离 story 的任务，此处是权威） */
  async findAllTasks() {
    const db = await ensureDb();
    return db.query.devTasks.findMany();
  }


  async create(id: string, dto: CreateDevTaskDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(devTasks).values({
      id,
      storyId: dto.story_id ?? null,
      productId: dto.product_id ?? null,
      moduleId: dto.module_id ?? null,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      estimation: dto.estimation,
      status: 'backlog',
      dependencies: dto.dependencies ?? [],
      tags: dto.tags ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, dto: UpdateDevTaskDTO): Promise<void> {
    const db = await ensureDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    // priority 曾漏在这一链里：route 映射了 dto.priority，但仓库层无对应分支，
    // 于是 PATCH {"priority":"P0"} 返回 200 success 而库里值不变（静默丢弃）。
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.estimation !== undefined) updateData.estimation = dto.estimation;
    if (dto.dependencies !== undefined) updateData.dependencies = dto.dependencies;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.affected_modules !== undefined) updateData.affectedModules = dto.affected_modules;
    if (dto.assignee !== undefined) updateData.assignee = dto.assignee;
    if (dto.story_id !== undefined) updateData.storyId = dto.story_id;
    if (dto.product_id !== undefined) updateData.productId = dto.product_id;
    if (dto.module_id !== undefined) updateData.moduleId = dto.module_id;

    await db.update(devTasks).set(updateData).where(eq(devTasks.id, id));
  }

  /**
   * 乐观锁状态流转（compare-and-set）：expectedStatus 存在时条件下推至 WHERE，
   * 保证「读-判-写」原子性（并发认领场景，docs/design/task-claim-concurrency.md §2）。
   * @returns 是否确实发生了流转（受影响行数 > 0）
   */
  async compareAndSetStatus(id: string, newStatus: string, expectedStatus?: string): Promise<boolean> {
    const db = await ensureDb();
    const condition = expectedStatus !== undefined
      ? and(eq(devTasks.id, id), eq(devTasks.status, expectedStatus))
      : eq(devTasks.id, id);
    const moved = await db
      .update(devTasks)
      .set({ status: newStatus, ...statusTimestamps(newStatus), updatedAt: new Date() })
      .where(condition)
      .returning({ id: devTasks.id });
    return moved.length > 0;
  }

  async delete(id: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(devTasks).where(eq(devTasks.id, id));
  }
}
