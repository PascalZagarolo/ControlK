-- Google Calendar mirror (inbound sync, Phase 1).
--
-- Naming: `external_calendar_events` is deliberately separate from the
-- existing workspace-scoped `calendar_events` (uRent's rental events,
-- linked to customers/contracts/vehicles). External events are
-- per-USER, not per-workspace, so personal appointments don't bleed
-- across team members. Merged views in the UI combine both sources.
--
-- The `workspace_id` column captures the user's active workspace AT
-- THE TIME of sync — used so external events can be filtered by the
-- workspace context the user is currently looking at. Not strict
-- isolation: a user switching workspace contexts will still see their
-- own external events because they're filtered by user_id.

CREATE TABLE IF NOT EXISTS "external_calendar_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL,

  -- Google identifiers
  "google_calendar_id" text NOT NULL,
  "google_event_id" text NOT NULL,
  "google_recurring_event_id" text,

  -- Content
  "title" text NOT NULL,
  "description" text,
  "location" text,

  -- Time
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "is_all_day" boolean NOT NULL DEFAULT false,
  "timezone" text NOT NULL DEFAULT 'Europe/Berlin',

  -- Attendees (denormalized for query-without-join speed)
  "attendees" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "organizer_email" text,
  "organizer_name" text,

  "recurrence_rule" text,

  -- 'confirmed' | 'tentative' | 'cancelled'
  "status" text NOT NULL DEFAULT 'confirmed',

  -- Sync metadata
  "google_etag" text,
  "google_updated_at" timestamp with time zone NOT NULL,
  "last_synced_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "external_calendar_events_user_event_unique"
    UNIQUE ("user_id", "google_calendar_id", "google_event_id")
);

CREATE INDEX IF NOT EXISTS "external_calendar_events_user_start_idx"
  ON "external_calendar_events" ("user_id", "start_at");
CREATE INDEX IF NOT EXISTS "external_calendar_events_workspace_start_idx"
  ON "external_calendar_events" ("workspace_id", "start_at");
CREATE INDEX IF NOT EXISTS "external_calendar_events_time_range_idx"
  ON "external_calendar_events" ("start_at", "end_at");

-- Sync state per (user, google calendar). For V1 we sync only the
-- primary calendar but the schema is multi-cal-ready.
CREATE TABLE IF NOT EXISTS "calendar_sync_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "google_calendar_id" text NOT NULL,
  "google_calendar_name" text,

  -- Google's nextSyncToken from the most recent successful sync.
  -- Drops back to NULL on 410 Gone, which triggers a fresh full sync.
  "sync_token" text,

  -- Push-notification watch metadata. Watches expire after ~7 days;
  -- the renew cron rebuilds them.
  "webhook_channel_id" text,
  "webhook_resource_id" text,
  "webhook_expires_at" timestamp with time zone,

  "is_enabled" boolean NOT NULL DEFAULT true,
  "last_synced_at" timestamp with time zone,

  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "calendar_sync_state_user_cal_unique"
    UNIQUE ("user_id", "google_calendar_id")
);
CREATE INDEX IF NOT EXISTS "calendar_sync_state_webhook_expiry_idx"
  ON "calendar_sync_state" ("webhook_expires_at");

-- Per-user calendar preferences. Stored separately from the user row
-- because the surface grows (working hours, week start, etc.) and we
-- don't want to bloat the hot `users` table.
CREATE TABLE IF NOT EXISTS "user_calendar_preferences" (
  "user_id" varchar(255) PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,

  -- 'day' | 'week' | 'month' | 'agenda' | 'inverse'
  "default_view" text NOT NULL DEFAULT 'week',
  "week_starts_on" integer NOT NULL DEFAULT 1,
  "show_weekends" boolean NOT NULL DEFAULT true,
  "default_event_duration_min" integer NOT NULL DEFAULT 30,
  "working_hours_start" time NOT NULL DEFAULT '09:00',
  "working_hours_end" time NOT NULL DEFAULT '18:00',

  -- Bi-directional sync toggles. master kills everything; the
  -- per-direction toggles let the user keep "Google read-only" or
  -- "uRent only push out" configurations once outbound lands.
  "google_sync_enabled" boolean NOT NULL DEFAULT true,
  "google_inbound_enabled" boolean NOT NULL DEFAULT true,
  "google_outbound_enabled" boolean NOT NULL DEFAULT false,

  "inverse_thresholds_enabled" boolean NOT NULL DEFAULT true,

  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
