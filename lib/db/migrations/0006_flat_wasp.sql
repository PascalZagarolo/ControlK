CREATE TABLE "customer_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	CONSTRAINT "customer_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "customer_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"color" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers_to_tags" (
	"customer_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "customers_to_tags_customer_id_tag_id_pk" PRIMARY KEY("customer_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "owner_id" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "onboarding_progress" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "onboarding_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_share_links" ADD CONSTRAINT "customer_share_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_share_links" ADD CONSTRAINT "customer_share_links_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_share_links" ADD CONSTRAINT "customer_share_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers_to_tags" ADD CONSTRAINT "customers_to_tags_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers_to_tags" ADD CONSTRAINT "customers_to_tags_tag_id_customer_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."customer_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_share_links_token_idx" ON "customer_share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "customer_share_links_customer_idx" ON "customer_share_links" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_tags_slug_workspace_idx" ON "customer_tags" USING btree ("workspace_id","slug");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_owner_idx" ON "customers" USING btree ("owner_id");