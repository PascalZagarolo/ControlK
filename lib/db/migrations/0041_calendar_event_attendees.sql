-- Calendar event attendees: link workspace members (other accounts) to an
-- internal calendar event — e.g. a customer meeting attended by "me + Vincent
-- Garber". RSVP status is stored for a future accept/decline UI; the creator
-- is added as 'accepted', everyone else as 'invited'. Workspace membership is
-- enforced in the action layer. ON DELETE CASCADE on both the event and the
-- user so the join row never dangles.

CREATE TYPE "public"."event_attendee_status" AS ENUM (
  'invited',
  'accepted',
  'declined',
  'tentative'
);

CREATE TABLE IF NOT EXISTS "calendar_event_attendees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "calendar_events"("id") ON DELETE CASCADE,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "status" "event_attendee_status" NOT NULL DEFAULT 'invited',
  "added_by_id" varchar(255) REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "calendar_event_attendees_event_user_idx"
  ON "calendar_event_attendees" ("event_id", "user_id");
CREATE INDEX IF NOT EXISTS "calendar_event_attendees_user_idx"
  ON "calendar_event_attendees" ("user_id");
