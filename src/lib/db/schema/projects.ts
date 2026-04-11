import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  metadata: jsonb('metadata').$type<{
    tech_stack: string[];
    version: string;
    tags: string[];
    total_stories?: number;
    total_tasks?: number;
    total_estimation?: number;
  }>().notNull().default({
    tech_stack: [],
    version: '1.0.0',
    tags: [],
  }),
  settings: jsonb('settings').$type<{
    llm_provider: string;
    auto_save: boolean;
    display_preferences: {
      show_priority_colors: boolean;
      show_estimation: boolean;
      default_view: 'map' | 'list' | 'kanban';
    };
  }>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
