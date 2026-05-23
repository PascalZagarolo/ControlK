CREATE TYPE "public"."damage_severity" AS ENUM('minor', 'major', 'totalschaden');--> statement-breakpoint
CREATE TYPE "public"."maintenance_kind" AS ENUM('service', 'inspection', 'reifenwechsel', 'cleaning', 'other');--> statement-breakpoint
CREATE TABLE "vehicle_damages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"customer_id" uuid,
	"contract_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"severity" "damage_severity" DEFAULT 'minor' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"photo_url" text,
	"cost_cents" integer,
	"resolved" integer DEFAULT 0 NOT NULL,
	"created_by_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kind" "maintenance_kind" DEFAULT 'service' NOT NULL,
	"title" text NOT NULL,
	"interval_km" integer,
	"interval_days" integer,
	"last_done_km" integer,
	"last_done_at" timestamp with time zone,
	"next_due_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	CONSTRAINT "vehicle_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "vehicle_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"color" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles_to_tags" (
	"vehicle_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "vehicles_to_tags_vehicle_id_tag_id_pk" PRIMARY KEY("vehicle_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "owner_id" varchar(255);--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "daily_rate_cents" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "weekend_surcharge_cents" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "acquisition_cents" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "monthly_fixed_costs_cents" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "service_interval_km" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "service_interval_days" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "last_service_km" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "last_service_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "notes" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "vehicle_damages" ADD CONSTRAINT "vehicle_damages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_damages" ADD CONSTRAINT "vehicle_damages_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_damages" ADD CONSTRAINT "vehicle_damages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_damages" ADD CONSTRAINT "vehicle_damages_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_damages" ADD CONSTRAINT "vehicle_damages_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_share_links" ADD CONSTRAINT "vehicle_share_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_share_links" ADD CONSTRAINT "vehicle_share_links_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_share_links" ADD CONSTRAINT "vehicle_share_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_tags" ADD CONSTRAINT "vehicle_tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles_to_tags" ADD CONSTRAINT "vehicles_to_tags_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles_to_tags" ADD CONSTRAINT "vehicles_to_tags_tag_id_vehicle_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."vehicle_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_damages_vehicle_idx" ON "vehicle_damages" USING btree ("vehicle_id","occurred_at");--> statement-breakpoint
CREATE INDEX "vehicle_damages_customer_idx" ON "vehicle_damages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "vehicle_maintenance_vehicle_idx" ON "vehicle_maintenance" USING btree ("vehicle_id","next_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_share_links_token_idx" ON "vehicle_share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "vehicle_share_links_vehicle_idx" ON "vehicle_share_links" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_tags_slug_workspace_idx" ON "vehicle_tags" USING btree ("workspace_id","slug");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicles_owner_idx" ON "vehicles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("workspace_id","status");