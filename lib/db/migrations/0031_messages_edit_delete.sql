-- Add edit + soft-delete tracking to channel messages.
-- editedAt is stamped on every UPDATE that changes the body; deletedAt
-- is the soft-delete tombstone (list queries filter on `deletedAt IS NULL`).
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
