-- Workspace-scoped tag pool + note attachment junction.
--
-- tags: single dictionary per workspace. (workspace_id, slug) is the
-- dedup key so case/spacing variants collapse on insert. `slug` is
-- always lowercase + kebab; `name` keeps the user's casing for display.
--
-- note_tags: many-to-many between notes and tags. The unique index on
-- (note_id, tag_id) doubles as the natural primary key.

CREATE TABLE IF NOT EXISTS "tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" varchar(64) NOT NULL,
  "color" varchar(16),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tags_workspace_slug_idx" ON "tags" ("workspace_id", "slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_workspace_idx" ON "tags" ("workspace_id", "name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "note_tags" (
  "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "note_tags_pk" ON "note_tags" ("note_id", "tag_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_tags_tag_idx" ON "note_tags" ("tag_id");
