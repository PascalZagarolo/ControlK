CREATE TYPE "public"."todo_energy" AS ENUM('deep', 'light', 'call', 'admin', 'quick');--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"title_template" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"due_offset_minutes" integer,
	"default_priority" "todo_priority",
	"default_energy" "todo_energy"
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"emoji" varchar(8),
	"description" text,
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "energy" "todo_energy";--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_group_id_todo_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."todo_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "share_links_group_idx" ON "share_links" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "workflow_steps_workflow_idx" ON "workflow_steps" USING btree ("workflow_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_slug_workspace_idx" ON "workflows" USING btree ("workspace_id","slug");