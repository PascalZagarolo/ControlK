-- Phase 3 metadata layer for Google-mirror events. Distinct from any
-- future metadata on the uRent rental calendar (calendar_events) —
-- these tables only reference external_calendar_events. If rental
-- events need metadata later we add a parallel set or unify.

-- Per-user notes / status / recap on an event. Unique on (event, user)
-- so each user has their own private metadata for an event (e.g.
-- when multiple workspace members attend the same meeting).
CREATE TYPE "public"."external_event_status" AS ENUM (
  'prep_needed',
  'prepared',
  'follow_up_due',
  'completed'
);
CREATE TYPE "public"."external_event_importance" AS ENUM (
  'low',
  'normal',
  'high'
);

CREATE TABLE IF NOT EXISTS "external_event_metadata" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "calendar_event_id" uuid NOT NULL REFERENCES "external_calendar_events"("id") ON DELETE CASCADE,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL,

  "note_markdown" text,
  "note_updated_at" timestamp with time zone,

  "agenda_items" jsonb NOT NULL DEFAULT '[]'::jsonb,

  "status" "external_event_status",
  "importance" "external_event_importance",

  "recap_markdown" text,
  "recap_created_at" timestamp with time zone,

  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "external_event_metadata_event_user_unique"
    UNIQUE ("calendar_event_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "external_event_metadata_user_idx"
  ON "external_event_metadata" ("user_id");
CREATE INDEX IF NOT EXISTS "external_event_metadata_workspace_idx"
  ON "external_event_metadata" ("workspace_id");

-- Polymorphic event → entity links. entity_type names which other
-- table entity_id refers to. No DB-level FK to entity_id because it's
-- polymorphic; application-level integrity. Allowed entity_types are
-- validated in the server actions.
CREATE TYPE "public"."external_event_entity_type" AS ENUM (
  'note',
  'todo',
  'customer',
  'project',
  'channel'
);
CREATE TYPE "public"."external_event_link_type" AS ENUM (
  'related_to',
  'prepares_for',
  'follows_up',
  'discussed_in'
);

CREATE TABLE IF NOT EXISTS "external_event_entity_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "calendar_event_id" uuid NOT NULL REFERENCES "external_calendar_events"("id") ON DELETE CASCADE,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL,

  "entity_type" "external_event_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "link_type" "external_event_link_type",

  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by_user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,

  CONSTRAINT "external_event_entity_links_unique"
    UNIQUE ("calendar_event_id", "entity_type", "entity_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "external_event_entity_links_reverse_idx"
  ON "external_event_entity_links" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "external_event_entity_links_user_idx"
  ON "external_event_entity_links" ("user_id", "entity_type");

-- Tag junction. Reuses the existing workspace-scoped `tags` table so
-- a tag created in notes can be applied to an event and vice versa.
CREATE TABLE IF NOT EXISTS "external_event_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "calendar_event_id" uuid NOT NULL REFERENCES "external_calendar_events"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "external_event_tags_unique"
    UNIQUE ("calendar_event_id", "tag_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "external_event_tags_tag_idx"
  ON "external_event_tags" ("tag_id");
CREATE INDEX IF NOT EXISTS "external_event_tags_user_idx"
  ON "external_event_tags" ("user_id");
