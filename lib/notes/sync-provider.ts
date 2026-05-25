'use client';

import type * as Y from 'yjs';

/**
 * Real-time sync provider for Notes — stub for Sprint A.2.
 *
 * The Y.Doc backed by IndexedDB is local-first today: it survives
 * reloads, multi-tab sync via BroadcastChannel works, and the
 * save-queue ferries snapshots to Postgres. What we DON'T have yet is
 * cross-device live collaboration — type on the desktop, see it on
 * the phone.
 *
 * That feature lives behind `NEXT_PUBLIC_NOTES_REALTIME_SYNC=true`. The
 * interface below is the binding point the editor will hook into once
 * we pick the transport (most likely Pusher, since it's already in the
 * dependency tree; Liveblocks if we ever need presence / cursors as a
 * paid upgrade).
 *
 * Until then `createSyncProvider` returns null and the editor falls
 * back to the local-first + save-queue path — exactly today's behavior.
 *
 * Wire-up plan when we implement:
 *
 *   1. Open a Pusher channel keyed by `note-${noteId}`, member-only.
 *   2. Subscribe to a server-broadcast `yjs.update` event carrying the
 *      remote Y.update bytes (base64-encoded for the JSON envelope).
 *   3. Apply each remote update with `Y.applyUpdate(doc, bytes)`.
 *   4. Hook `doc.on('update', (update, origin) => …)` — when origin is
 *      NOT this provider (local edit), POST the update bytes to
 *      `/api/notes/[id]/yjs-update`, which fans out via Pusher to other
 *      connected clients.
 *   5. Add server-side throttling so a typing burst doesn't bomb the
 *      Pusher quota (batch updates over a 200ms window).
 *
 * Out of scope for the stub: presence/awareness, cursors, conflict
 * banners. Those are Sprint A.3+ once the transport is reliable.
 */

export type SyncProvider = {
  /** Stop forwarding updates and tear down the transport. */
  destroy(): void;
  /** True once the provider has finished its initial handshake. */
  isConnected(): boolean;
};

export function isRealtimeSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  // NEXT_PUBLIC_ env vars are baked into the client bundle at build
  // time. We read it lazily so dev-server flag flips take effect on
  // the next page load without a code change.
  return process.env.NEXT_PUBLIC_NOTES_REALTIME_SYNC === 'true';
}

/**
 * Instantiates a sync provider for the given Y.Doc / noteId pair.
 *
 * Returns `null` when realtime sync is disabled (the V1 default). The
 * editor handles null by simply not wiring up — local-first + save-
 * queue covers the single-device case.
 */
export function createSyncProvider(_doc: Y.Doc, _noteId: string): SyncProvider | null {
  if (!isRealtimeSyncEnabled()) return null;

  // The real implementation will land in Sprint A.2. For now we
  // intentionally NO-OP so toggling the flag prematurely doesn't crash
  // the editor — it just behaves as if the flag were off.
  console.info(
    '[notes/sync-provider] NEXT_PUBLIC_NOTES_REALTIME_SYNC is set but the ' +
      'provider stub is in place — realtime sync will land in Sprint A.2.'
  );
  return null;
}
