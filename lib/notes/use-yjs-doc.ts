'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

/**
 * Local-first foundation for Notes.
 *
 * Builds one Y.Doc per `noteId` with IndexedDB persistence so the document
 * survives reloads + offline, and multiple tabs of the same browser sync
 * via BroadcastChannel (built into y-indexeddb).
 *
 * Returns:
 *   - `fragment` — the Y.XmlFragment BlockNote binds to (collaboration prop)
 *   - `ready`    — true once IndexedDB has hydrated; before this, the doc is
 *                  empty regardless of what was stored. Component must wait
 *                  before deciding whether to apply server-side initial
 *                  content (avoid double-applying).
 *
 * Cleanup destroys the persistence + doc on unmount so memory is freed when
 * the user navigates away from a note.
 */
export function useYjsDoc(noteId: string) {
  const doc = useMemo(() => new Y.Doc(), [noteId]);
  const fragment = useMemo(() => doc.getXmlFragment('blocknote'), [doc]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const persistence = new IndexeddbPersistence(`urent-note-${noteId}`, doc);
    persistence.whenSynced
      .then(() => setReady(true))
      .catch(() => setReady(true)); // fail-open: still render the editor

    return () => {
      persistence.destroy();
      doc.destroy();
      setReady(false);
    };
  }, [noteId, doc]);

  return { doc, fragment, ready };
}
