CREATE TABLE "contract_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"body" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title" text NOT NULL,
	"value_cents" integer,
	"snapshot_by_id" varchar(255),
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "contract_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"allow_signature" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	CONSTRAINT "contract_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "contract_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"signer_email" text,
	"signer_role" text,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"share_token" varchar(64)
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "owner_id" varchar(255);--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "accepted_by_name" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "accepted_by_email" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "discount_pct" integer;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "estimated_costs_cents" integer;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "parent_contract_id" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "renewal_of_title" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_revisions" ADD CONSTRAINT "contract_revisions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_revisions" ADD CONSTRAINT "contract_revisions_snapshot_by_id_users_id_fk" FOREIGN KEY ("snapshot_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_share_links" ADD CONSTRAINT "contract_share_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_share_links" ADD CONSTRAINT "contract_share_links_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_share_links" ADD CONSTRAINT "contract_share_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_revisions_contract_idx" ON "contract_revisions" USING btree ("contract_id","snapshot_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_share_links_token_idx" ON "contract_share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "contract_share_links_contract_idx" ON "contract_share_links" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_signatures_contract_idx" ON "contract_signatures" USING btree ("contract_id");--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;