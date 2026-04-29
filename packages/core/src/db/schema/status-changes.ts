import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const statusChanges = pgTable('status_changes', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  previousStatus: text('previous_status').notNull(),
  newStatus: text('new_status').notNull(),
  reason: text('reason'),
  changedBy: text('changed_by'),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
});
