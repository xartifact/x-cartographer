import { pgTable, text, real, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { userStories } from './user-stories';

/**
 * 研发任务（DevTask）—— 原 Task 正名。
 * 执行域实体：AI/人要干的活（编码/重构/测试/迁移），挂 story、依赖 DAG、CAS 认领。
 * 原 type 字段已废除（实体切割后分类价值失效），交付性质由 tags 承载
 * （惯例标签：architecture-enabler / implementation / refactor / bug 等）。
 * 见 docs/design/story-map-redesign.md §3.3。
 */
export const devTasks = pgTable('dev_tasks', {
  id: text('id').primaryKey(),
  /** 所属用户故事（产品级任务池任务可为空） */
  storyId: text('story_id').references(() => userStories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority').notNull().default('P2'),
  estimation: real('estimation').notNull().default(0),
  status: text('status').notNull().default('backlog'),
  dependencies: jsonb('dependencies').$type<string[]>().notNull().default([]),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  /** 涉及模块（§3.7：不填 = 继承所属 Story 的并集；填了 = 收窄） */
  affectedModules: jsonb('affected_modules').$type<string[]>().notNull().default([]),
  assignee: text('assignee'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
