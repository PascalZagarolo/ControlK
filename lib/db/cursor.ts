/**
 * Cursor-based pagination primitives.
 *
 * Used by list queries that may grow unbounded (todos, customers, contracts,
 * vehicles, notes). Each opaque cursor encodes:
 *   - the value of the primary sort column at the last visible row
 *   - the row's id as a tiebreaker (deterministic ordering even when sort
 *     values collide, e.g. multiple todos due at the same minute)
 *
 * Encoded as base64 JSON so the client never has to think about the shape
 * and so we can extend it later without breaking links.
 */

export type CursorPayload<T = string | number | null> = {
  /** Primary sort key value (e.g. dueAt ISO, name, position). null = sort empty/last */
  v: T;
  /** Stable id-tiebreaker — required so duplicate sort values still paginate */
  id: string;
};

export function encodeCursor<T>(payload: CursorPayload<T>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor<T = string | number | null>(
  raw: string | null | undefined
): CursorPayload<T> | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const obj = JSON.parse(json);
    if (typeof obj !== 'object' || obj === null || typeof obj.id !== 'string') {
      return null;
    }
    return obj as CursorPayload<T>;
  } catch {
    return null;
  }
}

export type Page<R, T = string | number | null> = {
  items: R[];
  /** null when there are no more pages */
  nextCursor: string | null;
  /** convenience for clients — they can show "X more" without another roundtrip */
  hasMore: boolean;
  /** Total count is intentionally NOT included — getting it costs a second query
   * that defeats the point of cursor pagination. Surface it only when really needed. */
  _sortKey?: T;
};

/**
 * Standard limit guard: default 50, max 200. Anything else suggests the
 * caller is trying to do client-side filtering and should refactor.
 */
export function clampLimit(input: number | string | undefined | null, dflt = 50): number {
  const n = Number(input ?? dflt);
  if (!Number.isFinite(n) || n <= 0) return dflt;
  return Math.min(200, Math.max(1, Math.floor(n)));
}
