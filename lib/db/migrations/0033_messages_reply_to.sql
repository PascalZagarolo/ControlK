-- Discord-style inline reply: a message may point to another message
-- in the same channel as the one it's replying to. The reply still lives
-- in the main message stream (parentId IS NULL); reply_to_id only adds
-- the contextual back-pointer rendered as a small quote above the body.
-- Distinct from parentId, which is used for thread replies inside a
-- thread panel (different semantic surface).
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_id" uuid;

-- Best-effort FK. ON DELETE SET NULL so a hard-deleted original doesn't
-- cascade and wipe out the reply itself. (Soft-deletes don't touch the
-- column either way.)
DO $$
BEGIN
  ALTER TABLE "messages"
    ADD CONSTRAINT "messages_reply_to_id_fkey"
    FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "messages_reply_to_idx" ON "messages" ("reply_to_id");
