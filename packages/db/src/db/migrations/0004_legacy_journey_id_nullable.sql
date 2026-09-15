-- 0004: 解除 legacy_journey_id 的 NOT NULL 约束
--
-- 背景：0003 把 user_stories.journey_id 重命名为 legacy_journey_id 作为回滚锚点，
-- 但保留了原有的 NOT NULL 约束（旧表 journey_id 是必填外键）。新架构下该列已退役
-- （schema 注释："禁止新代码读写"），新建故事不再写该列 → 插入必然违反 NOT NULL，
-- 导致新建故事接口 500。
--
-- 修复策略：退役列必须可空（它只是历史数据的留存锚点，新行天然为空）。
-- 幂等：DROP NOT NULL 对已可空的列是无操作。

ALTER TABLE "user_stories" ALTER COLUMN "legacy_journey_id" DROP NOT NULL;
