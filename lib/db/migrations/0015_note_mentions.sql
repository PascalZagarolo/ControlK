DO $$ BEGIN
  CREATE TYPE "note_mention_type" AS ENUM ('customer', 'contract', 'vehicle', 'channel', 'event', 'todo', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "note_mentions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "note_id" uuid NOT NULL,
  "mention_type" "note_mention_type" NOT NULL,
  "mention_id" text NOT NULL,
  "label" text NOT NULL,
  "block_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "note_mentions_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_mentions_note_idx" ON "note_mentions" ("note_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_mentions_target_idx" ON "note_mentions" ("mention_type", "mention_id");
