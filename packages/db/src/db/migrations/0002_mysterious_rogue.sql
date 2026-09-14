CREATE TABLE "adr_records" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"context" text NOT NULL,
	"decision" text NOT NULL,
	"consequences" text,
	"alternatives_considered" text,
	"supersedes" text,
	"milestone_id" text,
	"module_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seq" bigserial NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"target_date" timestamp with time zone,
	"status" text DEFAULT 'planned' NOT NULL,
	"adr_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "status_changes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "status_changes" CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "story_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "affected_modules" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_journeys" ADD COLUMN "priority" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_stories" ADD COLUMN "milestone_id" text;--> statement-breakpoint
ALTER TABLE "user_stories" ADD COLUMN "affected_modules" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "adr_records" ADD CONSTRAINT "adr_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adr_records" ADD CONSTRAINT "adr_records_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stories" ADD CONSTRAINT "user_stories_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;