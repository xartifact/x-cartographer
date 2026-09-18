import { pgTable, text, real, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { userStories } from './user-stories';
import { products } from './products';
import { systemModules } from './system-modules';

/**
 * 研发任务（DevTask）—— 工作空间实体。
 *
 * **两种锚定路径**（docs/design/domain-model.md §2.5）：
 * - 锚定 UserStory：有用户价值的工作项（默认路径），产品归属经 story→activity→product 派生
 * - 锚定 SystemModule：工程治理类工作（重构/技术债/架构一致性），产品归属需直连 product_id
 *
 * 工程治理类工作**不是用户故事**——用户不关心"Service 层一致性"。强行编入故事地图
 * 会重蹈「跟踪执行」垃圾桶覆辙（2026-09-18 骨架诊断结论）。
 *
 * 原 type 字段已废除（实体切割后分类价值失效），交付性质由 tags 承载
 * （惯例标签：architecture-enabler / implementation / refactor / bug 等）。
 */
export const devTasks = pgTable('dev_tasks', {
  id: text('id').primaryKey(),
  /** 锚定用户故事（工程治理类工作为空） */
  storyId: text('story_id').references(() => userStories.id, { onDelete: 'cascade' }),
  /**
   * 产品归属。挂 story 时经派生链回填；**不挂 story 时必填**——
   * 派生链在 story_id 为空时断裂，没有它无法回答"这任务属于哪个产品"。
   * （此列 2026-09-15 曾作为死列删除，属误删：当时证据只证明"无人使用"，
   *  未证明"不需要"——详见 domain-model.md §6.1）
   */
  productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }),
  /**
   * 模块锚定：工程治理类工作的主锚（架构治理载体）。
   * 与 affectedModules 的区别：本字段是**唯一主锚**，affectedModules 是**影响面标注**（可多个）。
   */
  moduleId: text('module_id').references(() => systemModules.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority').notNull().default('P2'),
  estimation: real('estimation').notNull().default(0),
  status: text('status').notNull().default('backlog'),
  dependencies: jsonb('dependencies').$type<string[]>().notNull().default([]),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  /** 涉及模块（信息性标注，可多个；主锚见 moduleId） */
  affectedModules: jsonb('affected_modules').$type<string[]>().notNull().default([]),
  assignee: text('assignee'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
