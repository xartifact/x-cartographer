import { pgTable, text, jsonb, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
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
 *
 * **身份 = (product_id, id)**（复合主键）：slug 只在所属产品的目录内唯一。
 * 曾用单列 id 作全局主键，与「目录按产品隔离」自相矛盾——两个产品各有
 * `cli` / `delivery` 这类通用名时，后写者会静默改写前者的模块（模块易主、零报错）。
 * 产品作用域不是新引入的约定，而是本表既有语义的补齐：product_id NOT NULL、
 * findByProductId、findMissingIds(productId, …) 早已全部按产品作用域。
 */
export const systemModules = pgTable(
  'system_modules',
  {
    /**
     * 人类可读稳定 slug（gateway / web-spa / shared-types），不用随机 id。
     * **作用域是产品**：仅在本产品目录内唯一（见下方复合主键）。
     */
    id: text('id').notNull(),
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
    /** 依赖的其他模块 id 列表（同产品目录内） */
    dependsOn: jsonb('depends_on').$type<string[]>().notNull().default([]),
    /** 主张来源（domain-model.md §3） */
    provenance: text('provenance')
      .$type<'human_asserted' | 'agent_inferred' | 'imported'>()
      .notNull()
      .default('agent_inferred'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 复合主键：模块身份 = (产品, slug)。
    // 曾用单列 `id PRIMARY KEY`，与「目录按产品隔离」矛盾——两个产品各有 `cli`
    // 时后者会静默改写前者（upsert 按 id 命中且不更新 product_id），模块易主且无报错。
    // 依据 module-refs.ts：「没有产品上下文就无从判断模块是否有效」。
    primaryKey({ columns: [t.productId, t.id] }),
    index('system_modules_product_id_idx').on(t.productId),
  ]
);
