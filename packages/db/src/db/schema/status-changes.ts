import { pgTable, text, timestamp, bigserial } from 'drizzle-orm/pg-core';

export const statusChanges = pgTable('status_changes', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  previousStatus: text('previous_status').notNull(),
  newStatus: text('new_status').notNull(),
  reason: text('reason'),
  changedBy: text('changed_by'),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  /** 严格单调序号（§9.2：getConstitutionAsOfMilestone 需要跨 adr_records.seq 与本表比较先后，
   *  两表各自的单调序号是唯一可靠基准，不用时间戳跨表比较） */
  seq: bigserial('seq', { mode: 'number' }),
});
