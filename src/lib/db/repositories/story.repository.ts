import { eq } from 'drizzle-orm';
import { ensureDb } from '../client';
import { userStories } from '../schema/user-stories';
import type { CreateUserStoryDTO, UpdateUserStoryDTO } from '@/types';

export class StoryRepository {
  async findByJourneyId(journeyId: string) {
    const db = await ensureDb();
    return db.query.userStories.findMany({
      where: eq(userStories.journeyId, journeyId),
      orderBy: [userStories.order],
      with: {
        tasks: true,
      },
    });
  }

  async create(id: string, dto: CreateUserStoryDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(userStories).values({
      id,
      journeyId: dto.journey_id,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      estimation: dto.estimation,
      acceptanceCriteria: dto.acceptance_criteria,
      tags: dto.tags,
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

    await db.update(userStories).set(updateData).where(eq(userStories.id, id));
  }

  async delete(id: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(userStories).where(eq(userStories.id, id));
  }
}
