-- Google OAuth login support.
--
-- oauth_accounts: durable link between (provider, sub) and our user.
-- A row only exists once the user has actually completed the OAuth
-- handshake. Unique on (provider, provider_account_id) so the same
-- Google account can't be linked to two of our users.
--
-- oauth_states: ephemeral PKCE/nonce/redirect storage between /start
-- and /callback. 10-minute TTL, one-time use (callback deletes the
-- row whether the exchange succeeds or fails).

CREATE TABLE IF NOT EXISTS "oauth_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL,
  "provider_account_id" text NOT NULL,
  "email" text,
  "name" text,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_idx"
  ON "oauth_accounts" ("provider", "provider_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_accounts_user_idx" ON "oauth_accounts" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_states" (
  "state" varchar(64) PRIMARY KEY NOT NULL,
  "provider" varchar(32) NOT NULL,
  "code_verifier" varchar(128) NOT NULL,
  "nonce" varchar(64) NOT NULL,
  "redirect_to" text DEFAULT '/' NOT NULL,
  "origin" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_states_expires_idx" ON "oauth_states" ("expires_at");
