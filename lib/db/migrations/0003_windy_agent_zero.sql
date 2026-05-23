CREATE TABLE "todo_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"emoji" varchar(8),
	"color" varchar(16),
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "todo_groups" ADD CONSTRAINT "todo_groups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_groups" ADD CONSTRAINT "todo_groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "todo_groups_slug_workspace_idx" ON "todo_groups" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "todo_groups_position_idx" ON "todo_groups" USING btree ("workspace_id","position");--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_group_id_todo_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."todo_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todos_group_idx" ON "todos" USING btree ("group_id","status");