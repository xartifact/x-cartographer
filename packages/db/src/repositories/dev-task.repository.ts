import { eq, and } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { devTasks } from '../db/schema/dev-tasks';
import type { CreateDevTaskDTO, UpdateDevTaskDTO } from '@x-cartographer/shared';

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

  async create(id: string, dto: CreateDevTaskDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(devTasks).values({
      id,
      storyId: dto.story_id ?? null,
      productId: dto.product_id ?? null,
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
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.estimation !== undefined) updateData.estimation = dto.estimation;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.dependencies !== undefined) updateData.dependencies = dto.dependencies;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.affected_modules !== undefined) updateData.affectedModules = dto.affected_modules;
    if (dto.assignee !== undefined) updateData.assignee = dto.assignee;
    if (dto.product_id !== undefined) updateData.productId = dto.product_id;

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
      .set({ status: newStatus, updatedAt: new Date() })
      .where(condition)
      .returning({ id: devTasks.id });
    return moved.length > 0;
  }

  /** 查询产品中所有任务（含产品级任务池） */
  async findByProductId(productId: string) {
    const db = await ensureDb();
    return db.query.devTasks.findMany({
      where: eq(devTasks.productId, productId),
    });
  }

  async delete(id: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(devTasks).where(eq(devTasks.id, id));
  }
}
