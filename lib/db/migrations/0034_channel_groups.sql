-- Channel groups: Discord-style category folders for channels. Each
-- workspace has its own ordered list of groups; channels reference a
-- group via channels.group_id. Ungrouped channels (group_id IS NULL)
-- render above all groups in the sidebar.
CREATE TABLE IF NOT EXISTS "channel_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "channel_groups_workspace_idx"
  ON "channel_groups" ("workspace_id", "position");

-- Backreference from channels. NULL = ungrouped (default).
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "group_id" uuid;

DO $$
BEGIN
  ALTER TABLE "channels"
    ADD CONSTRAINT "channels_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "channel_groups"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "channels_group_idx" ON "channels" ("group_id");
