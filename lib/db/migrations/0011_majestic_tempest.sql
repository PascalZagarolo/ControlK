ALTER TABLE "calendar_event_templates" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."calendar_event_kind";--> statement-breakpoint
CREATE TYPE "public"."calendar_event_kind" AS ENUM('meeting', 'call', 'focus', 'task', 'personal', 'health', 'travel', 'other', 'handover', 'return', 'maintenance', 'internal');--> statement-breakpoint
ALTER TABLE "calendar_event_templates" ALTER COLUMN "kind" SET DATA TYPE "public"."calendar_event_kind" USING "kind"::"public"."calendar_event_kind";--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "kind" SET DATA TYPE "public"."calendar_event_kind" USING "kind"::"public"."calendar_event_kind";