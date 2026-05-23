CREATE TABLE IF NOT EXISTS "note_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "note_id" uuid NOT NULL,
  "title" text NOT NULL,
  "document" jsonb NOT NULL,
  "created_by_id" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "note_revisions_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE cascade,
  CONSTRAINT "note_revisions_created_by_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_revisions_note_idx" ON "note_revisions" ("note_id", "created_at");
