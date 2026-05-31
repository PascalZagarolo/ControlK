/**
 * Client-side registry of just-created note ids. The "+ Neue Notiz" button
 * marks an id here right before optimistic navigation; FreshGate peeks it on
 * mount to decide whether to open the editor instantly with empty defaults
 * (no server render wait) instead of streaming the existing-note body.
 *
 * Deliberately NOT persisted (plain in-memory Set): after a reload the row
 * exists and the note should load via the normal server path. peek/clear are
 * split so React StrictMode's double-invoked initializers don't consume the
 * flag prematurely — peek is side-effect-free, clear runs in an effect.
 */
const fresh = new Set<string>();

export function markFreshNote(id: string): void {
  fresh.add(id);
}

export function peekFreshNote(id: string): boolean {
  return fresh.has(id);
}

export function clearFreshNote(id: string): void {
  fresh.delete(id);
}
