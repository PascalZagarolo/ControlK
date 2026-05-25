-- Backfill: ensure every shared (scope='business') workspace has at
-- least one channel. Workspaces created with template='leer' (or any
-- path that bypassed seedChannels) end up at /channels as a dead-end
-- without this. After this migration, future creates also seed via
-- ensureDefaultChannelExists() in lib/actions/workspace.ts.
--
-- Idempotent: skips workspaces that already have any channel.

INSERT INTO "channels" ("workspace_id", "slug", "name", "topic", "kind")
SELECT
  w.id,
  'general',
  'general',
  'Allgemeine Diskussion',
  'general'
FROM "workspaces" w
WHERE w.scope = 'business'
  AND NOT EXISTS (
    SELECT 1 FROM "channels" c WHERE c.workspace_id = w.id
  );

-- Add the workspace owner as a member of every newly-seeded channel so
-- they land with proper membership state (unread counts, etc).
INSERT INTO "channel_members" ("channel_id", "user_id")
SELECT c.id, w.owner_id
FROM "channels" c
JOIN "workspaces" w ON w.id = c.workspace_id
WHERE c.slug = 'general'
  AND c.name = 'general'
  AND NOT EXISTS (
    SELECT 1 FROM "channel_members" cm
    WHERE cm.channel_id = c.id AND cm.user_id = w.owner_id
  );
