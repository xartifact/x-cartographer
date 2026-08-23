import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const userJourneys = pgTable('user_journeys', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  persona: text('persona').notNull().default(''),
  priority: text('priority').notNull().default('medium'),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
