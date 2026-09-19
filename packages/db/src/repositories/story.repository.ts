import { eq } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { userStories } from '../db/schema/user-stories';
import type { CreateUserStoryDTO, UpdateUserStoryDTO } from '@x-cartographer/shared';

export class StoryRepository {
  async findById(id: string) {
    const db = await ensureDb();
    return db.query.userStories.findFirst({ where: eq(userStories.id, id) });
  }

  async findByActivityId(activityId: string) {
    const db = await ensureDb();
    return db.query.userStories.findMany({
      where: eq(userStories.activityId, activityId),
      orderBy: [userStories.order],
      with: {
        devTasks: true,
      },
    });
  }

  async create(id: string, dto: CreateUserStoryDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(userStories).values({
      id,
      activityId: dto.activity_id,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      estimation: dto.estimation,
      acceptanceCriteria: dto.acceptance_criteria,
      tags: dto.tags,
      affectedModules: dto.affected_modules ?? [],
      provenance: dto.provenance ?? 'agent_inferred',
      status: 'backlog',
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, dto: UpdateUserStoryDTO): Promise<void> {
    const db = await ensureDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.estimation !== undefined) updateData.estimation = dto.estimation;
    if (dto.acceptance_criteria !== undefined) updateData.acceptanceCriteria = dto.acceptance_criteria;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.order !== undefined) updateData.order = dto.order;
    if (dto.position !== undefined) updateData.position = dto.position;
    if (dto.milestoneId !== undefined) updateData.milestoneId = dto.milestoneId;
    if (dto.activityId !== undefined) updateData.activityId = dto.activityId;
    if (dto.userTaskId !== undefined) updateData.userTaskId = dto.userTaskId;
    if (dto.affected_modules !== undefined) updateData.affectedModules = dto.affected_modules;

    await db.update(userStories).set(updateData).where(eq(userStories.id, id));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const db = await ensureDb();
    await db
      .update(userStories)
      .set({ status, updatedAt: new Date() })
      .where(eq(userStories.id, id));
  }

  async delete(id: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(userStories).where(eq(userStories.id, id));
  }
}
