import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { products } from './products';

/**
 * 里程碑（版本）表 —— 排期模型的核心实体。
 * 基于里程碑/版本模型：故事挂到版本（v1.0/v1.1），版本有目标与可选目标日期。
 */
export const milestones = pgTable('milestones', {
  id: text('id').primaryKey(),
  projectId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal').notNull().default(''),
  targetDate: timestamp('target_date', { withTimezone: true }),
  status: text('status').notNull().default('planned'), // planned | active | completed
  /** 锚定的 ADR id（§3.7：可空纯字段，无 DB 外键，仓库层校验归属；seq 折叠的时间锚点） */
  adrId: text('adr_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
