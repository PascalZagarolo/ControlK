'use client';

import { saveNoteDocument } from '@/lib/actions/notes';

/**
 * Save-Queue for the notes module.
 *
 * Bridges the editor's debounced changes to the server, with three
 * properties the naive "await saveNoteDocument()" path lacks:
 *
 *   1. Survives tab close. The latest pending blocks are written to
 *      localStorage keyed by noteId — if the tab is closed before the
 *      debounce timer fires, the next page load picks them up and
 *      flushes them as soon as we're online.
 *
 *   2. Network-aware. When `navigator.onLine` is false, saves go to
 *      localStorage instead of the server. An `online` event listener
 *      flushes the queue automatically on reconnect.
 *
 *   3. Status events. UI surfaces (toolbar pulse, offline badge) can
 *      subscribe to status changes via `subscribe()` so the user sees
 *      "Offline" / "Saving" / "Synced" without prop-drilling.
 *
 * The Y.Doc is the local-first source of truth (via y-indexeddb). This
 * module is the *server-sync* layer on top — it never holds the
 * canonical document state, only ferries snapshots over.
 */

export type SyncStatus = 'synced' | 'saving' | 'pending' | 'offline';

type PendingEntry = {
  noteId: string;
  blocks: unknown;
  // Wall-clock when this entry was queued. Lets us age-out really old
  // ones if a server-side schema change ever makes them invalid.
  queuedAt: number;
};

type Listener = (status: SyncStatus) => void;

const STORAGE_PREFIX = 'ctrlk:note-pending:';
const MAX_PENDING_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

let status: SyncStatus = 'synced';
const listeners = new Set<Listener>();

// Per-note debounce timers. Keyed by noteId so different open notes
// don't reset each other's timers.
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// In-flight save promises. We don't fire two saves for the same noteId
// concurrently — if a save is already running, the new one waits.
const inflight = new Map<string, Promise<void>>();

function setStatus(next: SyncStatus): void {
  if (status === next) return;
  status = next;
  for (const fn of listeners) {
    try {
      fn(status);
    } catch (e) {
      console.warn('[save-queue] listener threw', e);
    }
  }
}

export function getStatus(): SyncStatus {
  return status;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

function storageKey(noteId: string): string {
  return `${STORAGE_PREFIX}${noteId}`;
}

function readPending(noteId: string): PendingEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(noteId));
    if (!raw) return null;
    const entry = JSON.parse(raw) as PendingEntry;
    // Age-out — corruption insurance, not normal operation.
    if (Date.now() - entry.queuedAt > MAX_PENDING_AGE_MS) {
      window.localStorage.removeItem(storageKey(noteId));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writePending(entry: PendingEntry): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(entry.noteId), JSON.stringify(entry));
  } catch (e) {
    // QuotaExceededError most likely — large doc, full localStorage.
    // Surface as a warning; the Y.Doc in IndexedDB still has the
    // latest content, so the user isn't losing data — they're losing
    // *eventual* sync until they edit again on a clean origin.
    console.warn('[save-queue] localStorage write failed', e);
  }
}

function clearPending(noteId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(noteId));
  } catch {}
}

/**
 * Iterates every pending entry currently in localStorage. Used by the
 * boot-time and reconnect flush — at runtime we usually only know the
 * one noteId we're editing, but a tab restore can find leftovers from
 * a previous session for other notes.
 */
function listAllPending(): PendingEntry[] {
  if (typeof window === 'undefined') return [];
  const out: PendingEntry[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const entry = JSON.parse(raw) as PendingEntry;
        if (Date.now() - entry.queuedAt > MAX_PENDING_AGE_MS) {
          window.localStorage.removeItem(key);
          continue;
        }
        out.push(entry);
      } catch {
        // Corrupt row — drop it. Not worth crashing the queue over.
        window.localStorage.removeItem(key);
      }
    }
  } catch {}
  return out;
}

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * Sends a single pending entry to the server. Resolves on success,
 * rejects on transport failure — the caller decides whether to
 * re-queue or escalate.
 */
async function sendOne(entry: PendingEntry): Promise<void> {
  const existing = inflight.get(entry.noteId);
  if (existing) {
    // A previous flush for the same note is in flight — wait for it
    // before starting a new one. The newer entry has already been
    // written to localStorage by queueSave(), so when we get our turn
    // we just read the latest.
    await existing;
  }
  const promise = (async () => {
    setStatus('saving');
    try {
      const latest = readPending(entry.noteId) ?? entry;
      const res = await saveNoteDocument(entry.noteId, latest.blocks);
      if (!res.ok) throw new Error(res.error || 'save failed');
      // Only clear if no newer edit landed in localStorage between
      // sendOne start and finish. Comparing queuedAt covers that.
      const post = readPending(entry.noteId);
      if (!post || post.queuedAt <= latest.queuedAt) {
        clearPending(entry.noteId);
      }
    } finally {
      inflight.delete(entry.noteId);
    }
  })();
  inflight.set(entry.noteId, promise);
  return promise;
}

/**
 * Flushes every pending entry currently in localStorage. Called on
 * boot, on `online` event, and after a queueSave debounce fires.
 *
 * Best-effort: failures stay queued for the next flush attempt.
 */
export async function flush(): Promise<void> {
  if (!isOnline()) {
    setStatus('offline');
    return;
  }
  const pending = listAllPending();
  if (pending.length === 0) {
    setStatus('synced');
    return;
  }
  setStatus('saving');
  let allOk = true;
  for (const entry of pending) {
    try {
      await sendOne(entry);
    } catch (e) {
      console.warn('[save-queue] flush failed for', entry.noteId, e);
      allOk = false;
    }
  }
  setStatus(allOk ? 'synced' : isOnline() ? 'pending' : 'offline');
}

/**
 * Debounced public entry point used by the editor. Always writes to
 * localStorage first so the document is durable across tab close, then
 * fires the actual server save after the debounce window.
 */
export function queueSave(noteId: string, blocks: unknown, debounceMs = 800): void {
  if (typeof window === 'undefined') return;
  writePending({ noteId, blocks, queuedAt: Date.now() });
  setStatus(isOnline() ? 'pending' : 'offline');

  const prev = debounceTimers.get(noteId);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    debounceTimers.delete(noteId);
    if (!isOnline()) {
      setStatus('offline');
      return;
    }
    void flush();
  }, debounceMs);
  debounceTimers.set(noteId, timer);
}

// One-time global setup. Idempotent so multiple editor mounts don't
// re-register listeners. The boot flush also runs here so a tab restore
// surfaces any leftover pending edits from a previous session.
let booted = false;

export function ensureBooted(): void {
  if (booted) return;
  if (typeof window === 'undefined') return;
  booted = true;

  // Online ⇒ try flushing whatever's queued.
  window.addEventListener('online', () => {
    void flush();
  });
  // Offline ⇒ just surface the status; nothing to do until we're back.
  window.addEventListener('offline', () => {
    setStatus('offline');
  });

  // Catch the case where the tab was closed mid-edit: localStorage
  // still has the unsynced blocks. Try to flush after the first paint
  // so we don't compete with React hydration.
  setTimeout(() => {
    void flush();
  }, 100);
}
