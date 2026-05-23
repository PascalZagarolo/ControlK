DROP INDEX "todo_groups_position_idx";--> statement-breakpoint
ALTER TABLE "todo_groups" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "todo_groups" ADD COLUMN "pinned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "todo_groups" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "todo_groups" ADD COLUMN "default_assignee_id" varchar(255);--> statement-breakpoint
ALTER TABLE "todo_groups" ADD COLUMN "default_priority" "todo_priority";--> statement-breakpoint
ALTER TABLE "todo_groups" ADD COLUMN "default_visibility" "todo_visibility";--> statement-breakpoint
ALTER TABLE "todo_groups" ADD CONSTRAINT "todo_groups_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todo_groups_position_idx" ON "todo_groups" USING btree ("workspace_id","pinned","position");