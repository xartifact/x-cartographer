import { eq } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { userActivities } from '../db/schema/user-activities';
import { userStories } from '../db/schema/user-stories';
import type {
  CreateUserActivityDTO,
  UpdateUserActivityDTO,
  UserActivity,
  UserStory,
} from '@x-cartographer/shared';

/**
 * 用户活动（UserActivity）repository —— backbone CRUD。
 * 原 JourneyRepository 退役。
 */
export class UserActivityRepository {
  async findByProductId(productId: string): Promise<UserActivity[]> {
    const db = await ensureDb();
    const rows = await db.query.userActivities.findMany({
      where: eq(userActivities.productId, productId),
      orderBy: [userActivities.order],
      with: {
        stories: {
          orderBy: [userStories.order],
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      product_id: row.productId,
      order: row.order,
      stories: (row.stories ?? []).map((s) => ({
        ...s,
        activity_id: s.activityId ?? '',
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
      })) as unknown as UserStory[],
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }));
  }

  async findById(id: string): Promise<UserActivity | null> {
    const db = await ensureDb();
    const row = await db.query.userActivities.findFirst({
      where: eq(userActivities.id, id),
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      product_id: row.productId,
      order: row.order,
      stories: [],
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async create(id: string, dto: CreateUserActivityDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(userActivities).values({
      id,
      productId: dto.product_id,
      name: dto.name,
      description: dto.description ?? '',
      order: dto.order ?? 0,
      provenance: dto.provenance ?? 'agent_inferred',
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, dto: UpdateUserActivityDTO): Promise<void> {
    const db = await ensureDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.order !== undefined) updateData.order = dto.order;

    await db.update(userActivities).set(updateData).where(eq(userActivities.id, id));
  }

  async delete(id: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(userActivities).where(eq(userActivities.id, id));
  }
}
