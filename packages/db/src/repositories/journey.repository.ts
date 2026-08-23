import { eq } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { userJourneys } from '../db/schema/user-journeys';
import type { CreateUserJourneyDTO, UpdateUserJourneyDTO } from '@x-cartographer/shared';

export class JourneyRepository {
  async findByProjectId(projectId: string) {
    const db = await ensureDb();
    return db.query.userJourneys.findMany({
      where: eq(userJourneys.projectId, projectId),
      orderBy: [userJourneys.order],
      with: {
        stories: {
          orderBy: [],
          with: {
            tasks: true,
          },
        },
      },
    });
  }

  async create(id: string, dto: CreateUserJourneyDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(userJourneys).values({
      id,
      projectId: dto.project_id,
      name: dto.name,
      description: dto.description,
      persona: dto.persona,
      priority: dto.priority ?? 'medium',
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, dto: UpdateUserJourneyDTO): Promise<void> {
    const db = await ensureDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.persona !== undefined) updateData.persona = dto.persona;
    if (dto.order !== undefined) updateData.order = dto.order;
    if (dto.priority !== undefined) updateData.priority = dto.priority;

    await db.update(userJourneys).set(updateData).where(eq(userJourneys.id, id));
  }

  async delete(id: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(userJourneys).where(eq(userJourneys.id, id));
  }
}
