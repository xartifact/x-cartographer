import { pgTable, text, integer, real, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { userActivities } from './user-activities';
import { userTasks } from './user-tasks';
import { milestones } from './milestones';

/**
 * 用户故事（UserStory）—— 用户故事地图的纵向切片。
 * 地图位置 = activity_id（必填，哪列）+ user_task_id（可选，哪个操作步骤）；
 * release 归属 = milestone_id（哪条切片线下）；
 * order 语义 = 同列内叙事深度序（骨架行在上，深化行向下）。
 * 见 docs/design/story-map-redesign.md §3.2。
 */
export const userStories = pgTable('user_stories', {
  id: text('id').primaryKey(),
  /** 地图列归属（backbone 用户活动） */
  activityId: text('activity_id').references(() => userActivities.id, { onDelete: 'cascade' }),
  /** 可选：活动下具体操作步骤（深化时挂） */
  userTaskId: text('user_task_id').references(() => userTasks.id, { onDelete: 'set null' }),
  /** [迁移保留] 原 journey 归属，退役列；迁移回滚锚点，禁止新代码读写 */
  legacyJourneyId: text('legacy_journey_id'),
  milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority').notNull().default('medium'),
  estimation: real('estimation').notNull().default(0),
  acceptanceCriteria: jsonb('acceptance_criteria').$type<string[]>().notNull().default([]),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  /** 涉及模块（SystemModule.id 引用，§3.7；空 = 未标注） */
  affectedModules: jsonb('affected_modules').$type<string[]>().notNull().default([]),
  status: text('status').default('backlog'),
  position: jsonb('position').$type<{ x: number; y: number } | null>(),
  /** 同列内叙事深度序（骨架行在上，深化行向下） */
  order: integer('order').notNull().default(0),
  /** 主张来源（domain-model.md §3；约束空间实体必带） */
  provenance: text('provenance').$type<'human_asserted' | 'agent_inferred' | 'imported'>().notNull().default('agent_inferred'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
