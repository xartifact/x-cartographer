import { eq, desc } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { statusChanges } from '../db/schema/status-changes';
import type { StatusChangeRecord } from '@x-cartographer/shared';

export class StatusChangeRepository {
  async findByEntityId(entityId: string): Promise<StatusChangeRecord[]> {
    const db = await ensureDb();
    const rows = await db
      .select()
      .from(statusChanges)
      .where(eq(statusChanges.entityId, entityId))
      .orderBy(desc(statusChanges.changedAt));

    return rows.map(this.toRecord);
  }

  async findAll(): Promise<StatusChangeRecord[]> {
    const db = await ensureDb();
    const rows = await db
      .select()
      .from(statusChanges)
      .orderBy(desc(statusChanges.changedAt));

    return rows.map(this.toRecord);
  }

  async create(record: StatusChangeRecord): Promise<void> {
    const db = await ensureDb();
    await db.insert(statusChanges).values({
      id: record.id,
      entityId: record.entity_id,
      entityType: record.entity_type,
      previousStatus: record.previous_status,
      newStatus: record.new_status,
      reason: record.reason ?? null,
      changedBy: record.changed_by ?? null,
      changedAt: new Date(record.changed_at),
    });
  }

  async createMany(records: StatusChangeRecord[]): Promise<void> {
    if (records.length === 0) return;
    const db = await ensureDb();
    await db.insert(statusChanges).values(
      records.map((r) => ({
        id: r.id,
        entityId: r.entity_id,
        entityType: r.entity_type,
        previousStatus: r.previous_status,
        newStatus: r.new_status,
        reason: r.reason ?? null,
        changedBy: r.changed_by ?? null,
        changedAt: new Date(r.changed_at),
      }))
    );
  }

  async deleteById(id: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(statusChanges).where(eq(statusChanges.id, id));
  }

  async deleteByEntityId(entityId: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(statusChanges).where(eq(statusChanges.entityId, entityId));
  }

  async deleteAll(): Promise<void> {
    const db = await ensureDb();
    await db.delete(statusChanges);
  }

  private toRecord(row: typeof statusChanges.$inferSelect): StatusChangeRecord {
    return {
      id: row.id,
      entity_id: row.entityId,
      entity_type: row.entityType as 'task' | 'story',
      previous_status: row.previousStatus,
      new_status: row.newStatus,
      reason: row.reason ?? undefined,
      changed_by: row.changedBy ?? undefined,
      changed_at: row.changedAt.toISOString(),
    };
  }
}
