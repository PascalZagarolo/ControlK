-- Persisted OAuth API tokens on the existing oauth_accounts rows.
--
-- access_token_enc / refresh_token_enc: AES-256-GCM blobs encrypted by
-- lib/auth/secret-encryption.ts (APP_ENCRYPTION_KEY). Nullable because
-- login-only OAuth (openid email profile) doesn't request them and we
-- don't want to force re-auth on every user when adding new scopes.
--
-- scopes: space-separated string of granted scopes. Lets the app check
-- "is this user connected for Gmail?" without re-running the OAuth
-- consent flow.

ALTER TABLE "oauth_accounts"
  ADD COLUMN IF NOT EXISTS "access_token_enc" text,
  ADD COLUMN IF NOT EXISTS "refresh_token_enc" text,
  ADD COLUMN IF NOT EXISTS "access_token_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "scopes" text;
