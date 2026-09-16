import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

/**
 * 产品（Product）—— 原 Project 正名。
 * 产品是持续演进的需求载体（非时间性"项目"），承载用户故事地图与发布线。
 * 见 docs/design/story-map-redesign.md §3.1。
 */
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  /** 产品服务的目标用户画像（原 journey.persona 上收至产品级） */
  persona: text('persona').notNull().default(''),
  metadata: jsonb('metadata')
    .$type<{
      tech_stack: string[];
      version: string;
      tags: string[];
      total_stories?: number;
      total_tasks?: number;
      total_estimation?: number;
    }>()
    .notNull()
    .default({
      tech_stack: [],
      version: '1.0.0',
      tags: [],
    }),
  settings: jsonb('settings')
    .$type<{
      auto_save: boolean;
      display_preferences: {
        show_priority_colors: boolean;
        show_estimation: boolean;
        default_view: 'map' | 'list' | 'kanban';
      };
      workspace_dir?: string;
    }>()
    .notNull(),
  /** 主张来源（domain-model.md §3；约束空间实体必带） */
  provenance: text('provenance').$type<'human_asserted' | 'agent_inferred' | 'imported'>().notNull().default('agent_inferred'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
