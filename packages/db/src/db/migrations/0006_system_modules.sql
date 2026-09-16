-- 0006: system_modules —— 模块目录升为一等实体
--
-- 背景（docs/design/domain-model.md §6.4）：
-- 原设计中模块只是 ADR changes.modules 的折叠投影，但"做系统设计"需要独立维护
-- 代码库结构认知（模块随代码演进持续更新，不属于"某时刻拍了什么板"）。
--
-- 单一真相约定：模块的**定义**只在本表。ADR 保留 module_ids（标注"这条决策涉及
-- 哪些模块"），但不再定义模块 —— 避免 §3.3 警告的"两份真相"漂移。
-- 因此本迁移把 changes.modules 的既有内容**迁出**到本表（若存在），
-- 之后 foldConstitution 不再产出 modules（改由本表提供）。
--
-- ID 规范例外：本表 id 是人类可读稳定 slug（gateway / web-spa），
-- 不走 short-id.ts 的 <PREFIX>-<序号> 规范（§3.6：Agent 需直接拼出/记住）。
-- 幂等：IF NOT EXISTS。

CREATE TABLE IF NOT EXISTS "system_modules" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "path" text DEFAULT '' NOT NULL,
  "responsibility" text DEFAULT '' NOT NULL,
  "depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "provenance" text DEFAULT 'agent_inferred' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "system_modules_product_id_idx" ON "system_modules" ("product_id");

-- 从既有 ADR changes.modules.upsert 迁出模块定义（按 seq 升序，后写覆盖先写；
-- 与 foldConstitution 的折叠语义一致）。remove 的模块不迁入（已被显式移除）。
-- ON CONFLICT DO NOTHING 保证幂等；已存在的模块（人工先建）不被覆盖。
INSERT INTO "system_modules" ("id", "product_id", "name", "path", "responsibility", "depends_on")
SELECT DISTINCT ON (entry->>'id')
  entry->>'id'                                        AS id,
  a."product_id"                                      AS product_id,
  COALESCE(entry->>'name', entry->>'id')              AS name,
  COALESCE(entry->>'path', '')                        AS path,
  COALESCE(entry->>'responsibility', '')              AS responsibility,
  COALESCE(entry->'depends_on', '[]'::jsonb)          AS depends_on
FROM "adr_records" a
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(a."changes"->'modules'->'upsert', '[]'::jsonb)) AS entry
WHERE a."changes"->'modules'->'upsert' IS NOT NULL
ORDER BY entry->>'id', a."seq" DESC
ON CONFLICT ("id") DO NOTHING;
