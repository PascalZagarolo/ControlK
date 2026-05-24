import Link from 'next/link';

export type ThreadRow = {
  gmailId: string;
  /** Local inbox_items row id, when we've synced this message. Null = open in Gmail. */
  localId: string | null;
  from: string;
  snippet: string;
  receivedAt: string;
  isRead: boolean;
  isCurrent: boolean;
};

/**
 * Chronological strip of every message in the same Gmail thread.
 *
 * Designed to live above the email header on /inbox/[id]. The
 * currently-open message is highlighted (amber rail + bold from),
 * other synced messages link into their own /inbox/[id] routes,
 * non-synced messages link out to Gmail because we have no local
 * surface for them yet.
 */
export function ThreadStrip({
  rows,
  threadId,
}: {
  rows: ThreadRow[];
  threadId: string | null;
}) {
  if (rows.length <= 1) return null;
  const gmailThreadUrl = threadId
    ? `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(threadId)}`
    : null;

  return (
    <section className="flex flex-col gap-2 rounded-[10px] border border-[#1F1F23] bg-white/[0.015] p-3">
      <header className="flex items-baseline justify-between gap-3 px-1 pb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
          Thread · {rows.length} Nachrichten
        </span>
        {gmailThreadUrl && (
          <a
            href={gmailThreadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#52525B] transition-colors hover:text-[#E8B86D]"
          >
            In Gmail ↗
          </a>
        )}
      </header>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <ThreadRowItem key={r.gmailId} row={r} threadId={threadId} />
        ))}
      </ul>
    </section>
  );
}

function ThreadRowItem({
  row,
  threadId,
}: {
  row: ThreadRow;
  threadId: string | null;
}) {
  const fromLabel = cleanFromLabel(row.from);
  const time = formatRel(row.receivedAt);

  const baseClass = `flex items-baseline gap-2 rounded-md px-2 py-1.5 transition-colors ${
    row.isCurrent
      ? 'bg-[rgba(232,184,109,0.06)] border-l-2 border-l-[#E8B86D] pl-2'
      : 'border-l-2 border-l-transparent hover:bg-white/[0.04]'
  }`;

  const content = (
    <>
      <span
        className={`shrink-0 truncate text-[12.5px] leading-tight ${
          row.isCurrent || !row.isRead
            ? 'font-medium text-ink-50'
            : 'text-ink-200'
        }`}
        style={{ maxWidth: 140 }}
      >
        {fromLabel}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] leading-tight text-ink-300">
        {row.snippet}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-[#52525B]">
        {time}
      </span>
    </>
  );

  if (row.isCurrent) {
    return (
      <li>
        <div className={baseClass}>{content}</div>
      </li>
    );
  }

  if (row.localId) {
    return (
      <li>
        <Link href={`/inbox/${row.localId}`} className={baseClass}>
          {content}
        </Link>
      </li>
    );
  }

  // No local row — link out to Gmail with the thread context.
  const gmailUrl = threadId
    ? `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(threadId)}/${encodeURIComponent(row.gmailId)}`
    : `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(row.gmailId)}`;
  return (
    <li>
      <a
        href={gmailUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClass}
        title="In Gmail öffnen (Nachricht noch nicht synchronisiert)"
      >
        {content}
        <span aria-hidden className="shrink-0 text-[10px] text-[#52525B]">↗</span>
      </a>
    </li>
  );
}

function cleanFromLabel(raw: string): string {
  if (!raw) return 'Unbekannt';
  const m = raw.match(/^(.*)<[^>]+>\s*$/);
  if (m) return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') || raw;
  return raw;
}

function formatRel(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.round(h / 24);
  if (dd < 14) return `${dd}d`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}
