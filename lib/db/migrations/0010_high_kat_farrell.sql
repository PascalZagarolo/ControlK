CREATE TYPE "public"."channel_kind" AS ENUM('general', 'customer', 'deal', 'damage', 'onboarding', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."channel_pinned_kind" AS ENUM('contract', 'customer', 'vehicle', 'todo', 'doc', 'thread', 'link');--> statement-breakpoint
CREATE TYPE "public"."deal_stage" AS ENUM('lead', 'angebot', 'verhandlung', 'gewonnen', 'verloren', 'onboarding', 'aktiv');--> statement-breakpoint
CREATE TABLE "channel_pinned_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"kind" "channel_pinned_kind" NOT NULL,
	"label" text NOT NULL,
	"target_id" text,
	"url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"pinned_by_id" varchar(255),
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone,
	"only_announcements" integer DEFAULT 0 NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	CONSTRAINT "channel_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "channel_snippets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "kind" "channel_kind" DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "deal_stage" "deal_stage";--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channel_pinned_items" ADD CONSTRAINT "channel_pinned_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_pinned_items" ADD CONSTRAINT "channel_pinned_items_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_pinned_items" ADD CONSTRAINT "channel_pinned_items_pinned_by_id_users_id_fk" FOREIGN KEY ("pinned_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_share_links" ADD CONSTRAINT "channel_share_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_share_links" ADD CONSTRAINT "channel_share_links_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_share_links" ADD CONSTRAINT "channel_share_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_snippets" ADD CONSTRAINT "channel_snippets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_snippets" ADD CONSTRAINT "channel_snippets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_pinned_items_channel_idx" ON "channel_pinned_items" USING btree ("channel_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_share_links_token_idx" ON "channel_share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "channel_share_links_channel_idx" ON "channel_share_links" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_snippets_slug_workspace_idx" ON "channel_snippets" USING btree ("workspace_id","slug");