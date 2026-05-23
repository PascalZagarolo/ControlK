CREATE TABLE "calendar_event_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "calendar_event_kind" NOT NULL,
	"default_duration_minutes" integer DEFAULT 60 NOT NULL,
	"default_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_id" uuid,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	CONSTRAINT "calendar_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "recurring_group_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "recurring_rule" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "reminder_minutes" integer;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "auto_spawn_source" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "created_by_id" varchar(255);--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event_templates" ADD CONSTRAINT "calendar_event_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_share_links" ADD CONSTRAINT "calendar_share_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_share_links" ADD CONSTRAINT "calendar_share_links_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_share_links" ADD CONSTRAINT "calendar_share_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_templates_slug_workspace_idx" ON "calendar_event_templates" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_share_links_token_idx" ON "calendar_share_links" USING btree ("token");--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_vehicle_range_idx" ON "calendar_events" USING btree ("linked_vehicle_id","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_events_recurring_idx" ON "calendar_events" USING btree ("recurring_group_id");