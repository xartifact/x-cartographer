-- 0008: 工作项的第二锚定路径（docs/design/domain-model.md §2.5）
--
-- 背景：初版规则「DevTask 引用 UserStory 允许且必须」在真实数据前不成立。
-- 工程治理类工作（重构/技术债/架构一致性）没有对应的用户故事，但需要：
--   ① 产品归属（不能经 story 派生，因为 story 为空）
--   ② 模块锚定（架构治理的载体，见 §2.5）
--
-- 本次恢复 dev_tasks.product_id（0007 曾作为死列删除，属误删——详见 §6.1 的追溯），
-- 并新增 dev_tasks.module_id。
--
-- ⚠ 与 0007 的关系：0007 删它时证据（0/536 填充 + 无读点）成立但结论错——
--   只证明了「当时无人使用」，未证明「不需要」。详见 domain-model.md §6.1。

-- 1) 产品归属：不挂 story 的工作项用它回溯产品
ALTER TABLE "dev_tasks" ADD COLUMN IF NOT EXISTS "product_id" text
  REFERENCES "products"("id") ON DELETE CASCADE;

-- 2) 模块锚定：工程治理类工作的主锚（架构治理载体）
--    与 affected_modules（jsonb 信息性标注，可多个）语义不同：
--    module_id 是唯一主锚，affects_modules 是影响面。
ALTER TABLE "dev_tasks" ADD COLUMN IF NOT EXISTS "module_id" text
  REFERENCES "system_modules"("id") ON DELETE SET NULL;

-- 3) 索引：按产品/模块查询工作项
CREATE INDEX IF NOT EXISTS "dev_tasks_product_id_idx" ON "dev_tasks" ("product_id");
CREATE INDEX IF NOT EXISTS "dev_tasks_module_id_idx" ON "dev_tasks" ("module_id");

-- 4) 回填：已有任务的产品归属经 story → activity → product 派生
--    幂等：只填 product_id IS NULL 的行。
UPDATE "dev_tasks" d
SET "product_id" = a."product_id"
FROM "user_stories" s
JOIN "user_activities" a ON a."id" = s."activity_id"
WHERE d."story_id" = s."id" AND d."product_id" IS NULL;
