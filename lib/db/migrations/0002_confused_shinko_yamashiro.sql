CREATE TYPE "public"."auto_rule_trigger" AS ENUM('contract_starting_tomorrow', 'contract_ending_in_14_days', 'contract_ending_in_30_days', 'contract_lost_followup_90d', 'lead_stale_10d', 'lead_stale_30d', 'vehicle_service_due', 'customer_inactive_30d', 'customer_onboarding_30d');--> statement-breakpoint
CREATE TYPE "public"."todo_activity_kind" AS ENUM('created', 'status_changed', 'priority_changed', 'due_changed', 'assigned', 'unassigned', 'commented', 'subtask_added', 'subtask_completed', 'subtask_removed', 'snoozed', 'claimed', 'delegated', 'delegation_accepted', 'delegation_rejected', 'auto_created', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."todo_priority" AS ENUM('niedrig', 'mittel', 'hoch', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."todo_status" AS ENUM('offen', 'in_arbeit', 'erledigt', 'abgebrochen');--> statement-breakpoint
CREATE TYPE "public"."todo_visibility" AS ENUM('private', 'team', 'account');--> statement-breakpoint
CREATE TABLE "todo_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" uuid NOT NULL,
	"actor_id" varchar(255),
	"kind" "todo_activity_kind" NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_auto_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" "auto_rule_trigger" NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"default_assignee_id" varchar(255),
	"default_priority" "todo_priority" DEFAULT 'mittel' NOT NULL,
	"last_run_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" uuid NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_subtasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_watchers" (
	"todo_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "todo_watchers_todo_id_user_id_pk" PRIMARY KEY("todo_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"assignee_id" varchar(255),
	"title" text NOT NULL,
	"description" text,
	"status" "todo_status" DEFAULT 'offen' NOT NULL,
	"priority" "todo_priority" DEFAULT 'mittel' NOT NULL,
	"visibility" "todo_visibility" DEFAULT 'team' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"snooze_until" timestamp with time zone,
	"snooze_trigger" jsonb,
	"customer_id" uuid,
	"contract_id" uuid,
	"vehicle_id" uuid,
	"channel_id" uuid,
	"source_message_id" uuid,
	"auto_rule_slug" text,
	"on_done_template" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todo_activity" ADD CONSTRAINT "todo_activity_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_activity" ADD CONSTRAINT "todo_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_auto_rules" ADD CONSTRAINT "todo_auto_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_auto_rules" ADD CONSTRAINT "todo_auto_rules_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_comments" ADD CONSTRAINT "todo_comments_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_comments" ADD CONSTRAINT "todo_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_subtasks" ADD CONSTRAINT "todo_subtasks_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_watchers" ADD CONSTRAINT "todo_watchers_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_watchers" ADD CONSTRAINT "todo_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todo_activity_todo_idx" ON "todo_activity" USING btree ("todo_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "todo_auto_rules_workspace_slug_idx" ON "todo_auto_rules" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "todo_comments_todo_idx" ON "todo_comments" USING btree ("todo_id","created_at");--> statement-breakpoint
CREATE INDEX "todo_subtasks_todo_idx" ON "todo_subtasks" USING btree ("todo_id","position");--> statement-breakpoint
CREATE INDEX "todos_workspace_status_idx" ON "todos" USING btree ("workspace_id","status","due_at");--> statement-breakpoint
CREATE INDEX "todos_assignee_status_idx" ON "todos" USING btree ("assignee_id","status","due_at");--> statement-breakpoint
CREATE INDEX "todos_customer_idx" ON "todos" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "todos_contract_idx" ON "todos" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "todos_vehicle_idx" ON "todos" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "todos_channel_idx" ON "todos" USING btree ("channel_id");