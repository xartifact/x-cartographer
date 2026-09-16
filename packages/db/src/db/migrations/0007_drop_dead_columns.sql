-- 0007: 死列清理（docs/design/domain-model.md §5「无死列」/ §6.1 / §6.5）
--
-- 判定标准（三维证据，缺一不可删除）：
--   ① 填充率 = 0（或实质为 0）
--   ② 无真实消费点（只有 schema/透传，无读取方使用其值）
--   ③ 删除不破坏已设计且可达的功能
--
-- 本迁移删除三列。删除是有意的破坏性操作，故逐列记录证据与替代方案。

-- ── 1) dev_tasks.product_id ──────────────────────────────────────────
-- 证据：填充 0/536（实测）；唯一读点 findByProductId 按 productId 过滤，
--       而"产品级任务池"注释所对应的 story_id IS NULL 任务为 0 条 → 恒返回空。
-- 替代：任务的产品归属经 dev_task → story → activity → product 传递（承重路径）。
--       池任务如需重建，story_id 本身可空，无需冗余列。
-- 影响：删 pool 查询分支（routes/dev-tasks.ts）；short-id 的 devTask refs 同步。
ALTER TABLE "dev_tasks" DROP COLUMN IF EXISTS "product_id";

-- ── 2) milestones.adr_id ─────────────────────────────────────────────
-- 证据：填充 0/18（实测）；全仓零读取点（唯一"读"是 ID 治理脚本的引用声明）；
--       设计用途（as-of 查询的 seq 锚点）已被 adr.repository.ts 用 milestones.createdAt
--       替代架空；schema 注释承诺的「仓库层校验归属」在代码中不存在。
-- 替代：权威方向是 adr_records.milestone_id（§5 已定 adr→milestone）；
--       as-of 查询继续用 createdAt（现状即如此）。
-- 影响：删 milestones.ts 的 adr_id zod/序列化；short-id 的 adr refs 同步。
ALTER TABLE "milestones" DROP COLUMN IF EXISTS "adr_id";

-- ── 3) products.persona ──────────────────────────────────────────────
-- 证据：填充 0/5（实测）；DB 列存在但 shared 类型、repository、route、CLI、UI
--       五层全无读写路径（grep 确认）；activity-create-dialog 注释明记"去 persona"。
-- 替代：设计文档 §3.4 曾称"persona 以字段形式保留在 Product 上"，但从未接线。
--       若将来需要用户画像，应作为 UserActivity/UserStory 的属性或独立实体重建，
--       而非产品级单值字符串（产品服务多类用户，单值本就是错建模）。
-- 影响：删 products 建表 SQL 中的 persona；schema-health 的特征清单同步。
ALTER TABLE "products" DROP COLUMN IF EXISTS "persona";
