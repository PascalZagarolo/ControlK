CREATE TYPE "public"."calendar_event_kind" AS ENUM('handover', 'return', 'internal', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('aktiv', 'auslaufend', 'storniert', 'entwurf', 'vorlage');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('aktiv', 'lead', 'inaktiv');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('mention', 'thread_reply', 'dm', 'system', 'deal', 'task');--> statement-breakpoint
CREATE TYPE "public"."vehicle_kind" AS ENUM('sprinter', 'transporter', 'pkw', 'kuehlfahrzeug');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('frei', 'vermietet', 'wartung', 'reserviert');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member', 'guest');--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "calendar_event_kind" NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"linked_customer_id" uuid,
	"linked_contract_id" uuid,
	"linked_vehicle_id" uuid
);
--> statement-breakpoint
CREATE TABLE "channel_members" (
	"channel_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"last_read_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_members_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"topic" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_id" uuid,
	"external_id" text,
	"title" text NOT NULL,
	"status" "contract_status" DEFAULT 'entwurf' NOT NULL,
	"template_of" text,
	"value_cents" integer DEFAULT 0,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"body" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_channels" (
	"customer_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "customer_channels_customer_id_channel_id_pk" PRIMARY KEY("customer_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"industry" text,
	"status" "customer_status" DEFAULT 'lead' NOT NULL,
	"initials" varchar(4) NOT NULL,
	"from_color" varchar(32) NOT NULL,
	"to_color" varchar(32) NOT NULL,
	"notes" text DEFAULT '',
	"forecast_contribution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"workspace_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"source_url" text NOT NULL,
	"actor_id" varchar(255),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"message_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_message_id_user_id_emoji_pk" PRIMARY KEY("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"initials" varchar(4) NOT NULL,
	"avatar_from" varchar(32) DEFAULT '#5eb6ff' NOT NULL,
	"avatar_to" varchar(32) DEFAULT '#0369a1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"external_id" text,
	"plate" text NOT NULL,
	"model" text NOT NULL,
	"kind" "vehicle_kind" NOT NULL,
	"status" "vehicle_status" DEFAULT 'frei' NOT NULL,
	"location" text,
	"km" integer DEFAULT 0,
	"next_service" text,
	"last_inspection" text,
	"rating_tenths" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short" varchar(4) NOT NULL,
	"from_color" varchar(32) NOT NULL,
	"to_color" varchar(32) NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_linked_customer_id_customers_id_fk" FOREIGN KEY ("linked_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_linked_contract_id_contracts_id_fk" FOREIGN KEY ("linked_contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_linked_vehicle_id_vehicles_id_fk" FOREIGN KEY ("linked_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_activity" ADD CONSTRAINT "customer_activity_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_channels" ADD CONSTRAINT "customer_channels_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_channels" ADD CONSTRAINT "customer_channels_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_range_idx" ON "calendar_events" USING btree ("workspace_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_slug_workspace_idx" ON "channels" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "customer_activity_customer_idx" ON "customer_activity" USING btree ("customer_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_slug_workspace_idx" ON "customers" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "messages_channel_idx" ON "messages" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_parent_idx" ON "messages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspaces" USING btree ("slug");