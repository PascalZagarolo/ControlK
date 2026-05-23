ALTER TABLE "workspaces" ADD COLUMN "scope" varchar(16) DEFAULT 'business' NOT NULL;
--> statement-breakpoint
-- Backfill scope based on existing template values
UPDATE "workspaces" SET "scope" = 'private' WHERE "template" IN ('familie', 'student');
