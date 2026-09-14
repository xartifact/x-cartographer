import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { products } from './products';

/**
 * 用户活动（UserActivity）—— 用户故事地图 Backbone 节点。
 * 横轴 = 用户达成目标的端到端叙事流（order 为叙事序，从左到右）。
 * 命名纪律：动词短语描述用户活动（如"组织故事地图"），非系统功能域。
 * 见 docs/design/story-map-redesign.md §3.2。
 */
export const userActivities = pgTable('user_activities', {
  id: text('id').primaryKey(),
  /** 所属产品（原 project） */
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  /** 活动名（动词短语，如"组织故事地图"） */
  name: text('name').notNull(),
  /** 活动描述 */
  description: text('description').notNull().default(''),
  /** 端到端叙事序（backbone 从左到右） */
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
