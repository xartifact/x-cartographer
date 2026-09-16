import { bigserial, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { products } from './products';
import { milestones } from './milestones';
import type { AdrChanges } from '@x-cartographer/shared';

/**
 * ADR 决策记录表 —— 技术宪法唯一持久化实体，仅追加（§3.1）。
 * 除 status 外全部字段一旦创建即不可变；status 是唯一允许变化的字段，
 * 变化复用 status_changes 审计账本（每次必须带理由），不直接改写本表。
 */
export const adrRecords = pgTable('adr_records', {
  id: text('id').primaryKey(),
  projectId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  /**
   * 文档/叙事层面的标签，不影响折叠结果（§3.1）。
   * 状态机: proposed → accepted | rejected; accepted → deprecated | superseded（终态不可再转）。
   */
  status: text('status').notNull().default('proposed'), // proposed | accepted | rejected | deprecated | superseded
  context: text('context').notNull(),
  decision: text('decision').notNull(),
  consequences: text('consequences'),
  alternativesConsidered: text('alternatives_considered'),
  /** 指向被这条替代的旧 ADR id（仅文档关联，撤销当前态必须走显式 changes.remove，§3.1） */
  supersedes: text('supersedes'),
  milestoneId: text('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
  /** 涉及哪些模块（SystemModule.id），信息性标注；模式同 user_stories.tags */
  moduleIds: jsonb('module_ids').$type<string[]>().notNull().default([]),
  /** 状态变更差异（§3.2）——记差异不记全量；无 changes 的 ADR 不参与折叠（§3.3） */
  changes: jsonb('changes').$type<AdrChanges>(),
  /** 主张来源（domain-model.md §3/§4.4：高影响 agent_inferred 写入落 proposed） */
  provenance: text('provenance').$type<'human_asserted' | 'agent_inferred' | 'imported'>().notNull().default('agent_inferred'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * DB 生成的严格单调序号，折叠排序的唯一权威依据（§3.3）——
   * 不用 created_at（同一毫秒并发写入时间戳相同，排序歧义）、不用 id（nanoid 不可排序）。
   */
  seq: bigserial('seq', { mode: 'number' }),
});
