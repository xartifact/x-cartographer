import { pgTable, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { products } from './products';

/**
 * 系统模块（SystemModule）—— 模块/组件目录，一等实体。
 *
 * 与 ADR 中 tech_stack / architecture_principles 的区别（重要）：
 * - 那两者是**决策**：每次变更是决策事件，记在 ADR 日志里，靠 foldConstitution 派生当前态。
 * - 模块目录是**结构认知**：它描述"代码库现在有哪些模块"，随代码演进持续更新，
 *   不属于"某个时刻拍了什么板"。因此它是独立表，而非 ADR 折叠的投影。
 *
 * 单一真相约定：模块的**定义**只存在于本表。ADR 通过 `module_ids` 标注
 * "这条决策涉及哪些模块"，但**不再定义模块**（`changes.modules` 机制已移除），
 * 避免 technical-constitution.md §3.3 警告的"两份真相"漂移。
 *
 * ID 规范例外：本表 id 是人类可读稳定 slug（`gateway` / `web-spa`），
 * **不走** short-id.ts 的 `<PREFIX>-<序号>` 规范——理由见 §3.6：
 * 它会被 principles.module_ids 与 Story/Task.affected_modules 反复引用，
 * Agent 需要能直接拼出/记住它。rename-entity-ids.ts 已将其排除在重写范围外。
 */
export const systemModules = pgTable(
  'system_modules',
  {
    /** 人类可读稳定 slug（gateway / web-spa / shared-types），不用随机 id */
    id: text('id').primaryKey(),
    /** 所属产品（模块目录按产品隔离） */
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** 模块名称 */
    name: text('name').notNull(),
    /** 代码库路径（如 apps/server） */
    path: text('path').notNull().default(''),
    /** 职责描述 */
    responsibility: text('responsibility').notNull().default(''),
    /** 依赖的其他模块 id 列表 */
    dependsOn: jsonb('depends_on').$type<string[]>().notNull().default([]),
    /** 主张来源（domain-model.md §3） */
    provenance: text('provenance')
      .$type<'human_asserted' | 'agent_inferred' | 'imported'>()
      .notNull()
      .default('agent_inferred'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('system_modules_product_id_idx').on(t.productId)]
);
