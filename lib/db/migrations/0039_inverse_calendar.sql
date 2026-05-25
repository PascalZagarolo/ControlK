-- Inverse Calendar foundation (Phase 4 MVP).
--
-- activity_log: unified interaction stream. Every meeting, email,
-- channel mention etc. lands here so the threshold engine has one
-- place to read from.
--
-- entity_thresholds: per-user, per-entity rhythm + standstill state.
-- Computed daily by the threshold-compute cron from activity_log.
--
-- Both tables are intentionally user-scoped (not workspace-shared)
-- because "who you haven't talked to" is a private signal — your
-- standstills shouldn't bleed into a teammate's view of the same
-- workspace.

CREATE TYPE "public"."activity_kind" AS ENUM (
  'event_attended',
  'event_organized',
  'email_received',
  'email_sent',
  'channel_message_received',
  'channel_message_sent',
  'note_mention',
  'todo_assigned',
  'recap_written',
  'manual_touch'
);

CREATE TYPE "public"."activity_entity_type" AS ENUM (
  'person',
  'customer',
  'project',
  'channel',
  'note'
);

CREATE TABLE IF NOT EXISTS "activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "activity_kind" "activity_kind" NOT NULL,
  "entity_type" "activity_entity_type" NOT NULL,
  "entity_id" text NOT NULL,
  "entity_display_name" text NOT NULL,
  "source_type" text,
  "source_id" uuid,
  "weight" integer NOT NULL DEFAULT 1,
  "occurred_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "activity_log_entity_idx"
  ON "activity_log" ("workspace_id", "entity_type", "entity_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "activity_log_occurred_idx"
  ON "activity_log" ("occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "activity_log_user_idx"
  ON "activity_log" ("user_id", "occurred_at" DESC);

-- Idempotency for backfill: same (user, source, entity) tuple never
-- inserts twice. Partial because source_id is nullable for things like
-- 'manual_touch' which have no source row.
CREATE UNIQUE INDEX IF NOT EXISTS "activity_log_source_unique_idx"
  ON "activity_log" ("user_id", "source_type", "source_id", "entity_type", "entity_id")
  WHERE "source_type" IS NOT NULL AND "source_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "entity_thresholds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "entity_type" "activity_entity_type" NOT NULL,
  "entity_id" text NOT NULL,
  "entity_display_name" text NOT NULL,

  "total_interactions" integer NOT NULL DEFAULT 0,
  "first_interaction_at" timestamp with time zone,
  "last_interaction_at" timestamp with time zone,

  -- Median + IQR are more robust to outliers than mean + stddev.
  -- One vacation gap of 60 days won't blow up the threshold.
  "median_days_between" real,
  "iqr_days_between" real,

  "alert_threshold_days" integer NOT NULL DEFAULT 21,
  "user_set_threshold" integer,
  "is_muted" boolean NOT NULL DEFAULT false,
  "muted_until" timestamp with time zone,

  "is_in_standstill" boolean NOT NULL DEFAULT false,
  "standstill_since" timestamp with time zone,
  "last_acknowledged_at" timestamp with time zone,

  "importance_score" real NOT NULL DEFAULT 0,

  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "entity_thresholds_user_entity_unique"
    UNIQUE ("user_id", "entity_type", "entity_id")
);

CREATE INDEX IF NOT EXISTS "entity_thresholds_standstill_idx"
  ON "entity_thresholds" ("user_id", "is_in_standstill");
CREATE INDEX IF NOT EXISTS "entity_thresholds_importance_idx"
  ON "entity_thresholds" ("user_id", "importance_score" DESC);
