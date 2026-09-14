import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { userActivities } from './user-activities';

/**
 * 用户任务（UserTask）—— 活动下的用户操作步骤。
 * 弱实体（地图元素）：描述用户为完成活动执行的具体操作（如"拖拽调整故事位置"），
 * 不是需求容器，也不是研发任务（那是 DevTask）。
 * 见 docs/design/story-map-redesign.md §3.2。
 */
export const userTasks = pgTable('user_tasks', {
  id: text('id').primaryKey(),
  /** 所属用户活动 */
  activityId: text('activity_id').notNull().references(() => userActivities.id, { onDelete: 'cascade' }),
  /** 任务名（用户操作短语，如"拖拽调整故事位置"） */
  name: text('name').notNull(),
  /** 任务描述 */
  description: text('description').notNull().default(''),
  /** 活动内排序 */
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
