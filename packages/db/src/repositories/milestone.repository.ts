import { eq } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { milestones } from '../db/schema/milestones';
import type { CreateMilestoneDTO, UpdateMilestoneDTO } from '@xpm/shared';

export class MilestoneRepository {
  async findByProjectId(projectId: string) {
    const db = await ensureDb();
    return db.query.milestones.findMany({
      where: eq(milestones.projectId, projectId),
      orderBy: [milestones.createdAt],
    });
  }

  async findById(id: string) {
    const db = await ensureDb();
    return db.query.milestones.findFirst({
      where: eq(milestones.id, id),
    });
  }

  async create(id: string, dto: CreateMilestoneDTO): Promise<void> {
    const db = await ensureDb();
    const now = new Date();
    await db.insert(milestones).values({
      id,
      projectId: dto.project_id,
      name: dto.name,
      goal: dto.goal ?? '',
      targetDate: dto.target_date ? new Date(dto.target_date) : null,
      status: dto.status ?? 'planned',
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, dto: UpdateMilestoneDTO): Promise<void> {
    const db = await ensureDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.goal !== undefined) updateData.goal = dto.goal;
    if (dto.target_date !== undefined) {
      updateData.targetDate = dto.target_date ? new Date(dto.target_date) : null;
    }
    if (dto.status !== undefined) updateData.status = dto.status;

    await db.update(milestones).set(updateData).where(eq(milestones.id, id));
  }

  async delete(id: string): Promise<void> {
    const db = await ensureDb();
    // ON DELETE SET NULL: 故事的 milestone_id 自动置空,回到待规划池
    await db.delete(milestones).where(eq(milestones.id, id));
  }
}
