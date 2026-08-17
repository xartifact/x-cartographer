import { pgTable, text, integer, real, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { userJourneys } from './user-journeys';
import { milestones } from './milestones';

export const userStories = pgTable('user_stories', {
  id: text('id').primaryKey(),
  journeyId: text('journey_id').notNull().references(() => userJourneys.id, { onDelete: 'cascade' }),
  milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority').notNull().default('medium'),
  estimation: real('estimation').notNull().default(0),
  acceptanceCriteria: jsonb('acceptance_criteria').$type<string[]>().notNull().default([]),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  status: text('status').default('backlog'),
  position: jsonb('position').$type<{ x: number; y: number } | null>(),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
