-- Per-user cache for the Foyer's AI-generated daily briefing.
--
-- One row per user. signal_hash invalidates on state change (new
-- awaiting reply, completed todo, etc.); expires_at adds a soft TTL
-- so we eventually re-generate even when signals are unchanged —
-- the model can offer time-of-day-aware phrasing as hours move on.

CREATE TABLE IF NOT EXISTS "user_briefings" (
  "user_id" varchar(255) PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "narrative" text NOT NULL,
  "signal_hash" varchar(64) NOT NULL,
  "generated_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
