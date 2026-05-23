DO $$ BEGIN
  CREATE TYPE "plan_tier" AS ENUM ('free', 'solo', 'team');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "workspace_id" uuid PRIMARY KEY NOT NULL,
  "plan" "plan_tier" DEFAULT 'free' NOT NULL,
  "seats" integer DEFAULT 1 NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscriptions_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_idx" ON "subscriptions" ("stripe_subscription_id");
