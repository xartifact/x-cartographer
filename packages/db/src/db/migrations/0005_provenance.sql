-- 0005: provenance 列（docs/design/domain-model.md §3 约束写入协议）
-- 约束空间六实体（products/milestones/user_activities/user_tasks/user_stories/adr_records）
-- 加 provenance：human_asserted | agent_inferred | imported，默认 agent_inferred（失败安全）。
-- 幂等：ADD COLUMN IF NOT EXISTS。存量数据视为 imported？否——视为 agent_inferred
--（存量由 Agent 迁移/导入产生，保守归入推断类，人工可后改）。

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL;
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL;
ALTER TABLE "user_activities" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL;
ALTER TABLE "user_tasks" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL;
ALTER TABLE "user_stories" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL;
ALTER TABLE "adr_records" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'agent_inferred' NOT NULL;
