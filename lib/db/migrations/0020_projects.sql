-- Projects: workspace-level grouping that spans modules.
-- Optional FK from todo_groups and todos. Existing rows get NULL (no
-- backfill — we don't want to retroactively place existing groups into
-- a synthetic project).

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "color" varchar(16),
  "position" integer DEFAULT 0 NOT NULL,
  "archived_at" timestamp with time zone,
  "created_by_id" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "projects_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade,
  CONSTRAINT "projects_created_by_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_workspace_idx" ON "projects" ("workspace_id", "position");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_workspace_idx" ON "projects" ("workspace_id", "slug");
--> statement-breakpoint

ALTER TABLE "todo_groups"
  ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "todo_groups_project_idx" ON "todo_groups" ("project_id");
--> statement-breakpoint

ALTER TABLE "todos"
  ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "todos_project_idx" ON "todos" ("project_id");
