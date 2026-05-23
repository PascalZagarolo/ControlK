DO $$ BEGIN
  CREATE TYPE "note_scope" AS ENUM ('private', 'workspace', 'public');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "parent_note_id" uuid,
  "title" text DEFAULT 'Unbenannt' NOT NULL,
  "icon" varchar(8),
  "cover_image_url" text,
  "scope" "note_scope" DEFAULT 'workspace' NOT NULL,
  "share_token" varchar(64),
  "document" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_template" boolean DEFAULT false NOT NULL,
  "template_key" text,
  "position" numeric(20, 10) DEFAULT '0' NOT NULL,
  "archived_at" timestamp with time zone,
  "created_by_id" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notes_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade,
  CONSTRAINT "notes_parent_note_id_fk" FOREIGN KEY ("parent_note_id") REFERENCES "notes"("id") ON DELETE set null,
  CONSTRAINT "notes_created_by_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_workspace_idx" ON "notes" ("workspace_id", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_parent_idx" ON "notes" ("parent_note_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notes_share_token_idx" ON "notes" ("share_token");
