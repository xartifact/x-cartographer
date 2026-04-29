import { pgTable, text, real, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { userStories } from './user-stories';

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => userStories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  type: text('type').notNull().default('technical_task'),
  priority: text('priority').notNull().default('P2'),
  estimation: real('estimation').notNull().default(0),
  status: text('status').notNull().default('backlog'),
  dependencies: jsonb('dependencies').$type<string[]>().notNull().default([]),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  assignee: text('assignee'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
