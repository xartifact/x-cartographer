import { eq } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { tasks } from '../db/schema/tasks';
import type { CreateTaskDTO, UpdateTaskDTO } from '@xpm/shared';

export class TaskRepository {
  async findById(id: string) {
    const db = await ensureDb();
    return db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  }

  async findByStoryId(storyId: string) {
    const db = await ensureDb();
    return db.query.tasks.findMany({
      where: eq(tasks.storyId, storyId),
    });
  }

  async create(id: string, dto: CreateTaskDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(tasks).values({
      id,
      storyId: dto.story_id,
      title: dto.title,
      description: dto.description,
      type: dto.type,
      priority: dto.priority,
      estimation: dto.estimation,
      status: 'backlog',
      dependencies: dto.dependencies ?? [],
      tags: dto.tags ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, dto: UpdateTaskDTO): Promise<void> {
    const db = await ensureDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.estimation !== undefined) updateData.estimation = dto.estimation;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.dependencies !== undefined) updateData.dependencies = dto.dependencies;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.assignee !== undefined) updateData.assignee = dto.assignee;

    await db.update(tasks).set(updateData).where(eq(tasks.id, id));
  }

  async delete(id: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(tasks).where(eq(tasks.id, id));
  }
}
