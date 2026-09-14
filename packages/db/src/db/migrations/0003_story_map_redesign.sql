-- 0003: story-map-redesign（docs/design/story-map-redesign.md §4）
-- 存量库迁移：projects→products、journey 退役、tasks→dev_tasks、新表 user_activities/user_tasks
-- 可回滚：journey 数据保留在 _legacy 表；stories.journey_id 列保留

-- 1) 平台域：projects → products
ALTER TABLE "projects" RENAME TO "products";
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "persona" text DEFAULT '' NOT NULL;
ALTER TABLE "milestones" RENAME COLUMN "project_id" TO "product_id";
-- adr_records 可能不存在（ADR 功能未上线的产品库）：先幂等建表再 rename
CREATE TABLE IF NOT EXISTS "adr_records" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "status" text DEFAULT 'proposed' NOT NULL,
  "context" text NOT NULL,
  "decision" text NOT NULL,
  "consequences" text,
  "alternatives_considered" text,
  "supersedes" text,
  "milestone_id" text REFERENCES "milestones"("id") ON DELETE SET NULL,
  "module_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "changes" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "seq" bigserial NOT NULL
);
ALTER TABLE "adr_records" RENAME COLUMN "project_id" TO "product_id";

-- 2) 用户域：新表
CREATE TABLE IF NOT EXISTS "user_activities" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "user_tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "activity_id" text NOT NULL REFERENCES "user_activities"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3) stories：加新列（journey_id 保留为 legacy 锚点，FK 改为不阻塞）
ALTER TABLE "user_stories" ADD COLUMN IF NOT EXISTS "activity_id" text REFERENCES "user_activities"("id") ON DELETE CASCADE;
ALTER TABLE "user_stories" ADD COLUMN IF NOT EXISTS "user_task_id" text REFERENCES "user_tasks"("id") ON DELETE SET NULL;
ALTER TABLE "user_stories" RENAME COLUMN "journey_id" TO "legacy_journey_id";

-- 4) 执行域：tasks → dev_tasks
UPDATE "tasks" SET "tags" = "tags" || to_jsonb(ARRAY["type"])::jsonb WHERE "type" IS NOT NULL AND NOT "tags" ? "type";
ALTER TABLE "tasks" RENAME TO "dev_tasks";
ALTER TABLE "dev_tasks" DROP COLUMN IF EXISTS "type";
ALTER TABLE "dev_tasks" RENAME COLUMN "project_id" TO "product_id";

-- 5) journey 数据保全（改名 legacy 保留；不 drop——回滚与审计依据）
ALTER TABLE "user_journeys" RENAME TO "_legacy_user_journeys";
