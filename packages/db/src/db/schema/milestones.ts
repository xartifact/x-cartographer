import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';

/**
 * 里程碑（版本）表 —— 排期模型的核心实体。
 * 基于里程碑/版本模型：故事挂到版本（v1.0/v1.1），版本有目标与可选目标日期。
 */
export const milestones = pgTable('milestones', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal').notNull().default(''),
  targetDate: timestamp('target_date', { withTimezone: true }),
  status: text('status').notNull().default('planned'), // planned | active | completed
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
