import Link from 'next/link';
import type { PersonEmail } from '@/lib/db/queries/person-profile';

// Chronological merged timeline of every email between us and this
// person. Visual rhythm: inbox rows left-aligned + bright, sent rows
// indented + muted + amber-tinted left rail. Newest at the bottom
// (oldest first overall) so the conversation reads like a chat.
export function PersonTimeline({ emails }: { emails: PersonEmail[] }) {
  if (emails.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 rounded-[10px] border border-white/[0.04] bg-white/[0.015] py-16 text-center">
        <p className="text-[14px] text-ink-100">Noch keine gemeinsamen Mails.</p>
        <p className="max-w-[320px] text-[12.5px] leading-[1.6] text-ink-300">
          Sobald du oder diese Person eine Mail mit dieser Adresse schickt,
          taucht sie hier auf.
        </p>
      </section>
    );
  }

  // Bucket by month so the timeline has rhythm rather than reading as
  // an endless column. Months without messages collapse implicitly.
  const buckets = bucketByMonth(emails);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#52525B]">
          Verlauf
        </span>
        <h2 className="mt-1 text-[15px] font-medium text-ink-50">
          {emails.length} Nachricht{emails.length === 1 ? '' : 'en'} insgesamt
        </h2>
      </header>

      {buckets.map((bucket) => (
        <div key={bucket.key} className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
            {bucket.label}
          </p>
          <ul className="flex flex-col gap-1.5">
            {bucket.items.map((email) => (
              <li key={email.id}>
                <TimelineRow email={email} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function TimelineRow({ email }: { email: PersonEmail }) {
  const isSent = email.direction === 'sent';
  const railColor = isSent ? '#E8B86D' : 'rgba(255,255,255,0.18)';
  return (
    <Link
      href={`/inbox/${email.id}`}
      className={`block rounded-[8px] border border-white/[0.04] bg-white/[0.015] py-2 pr-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.03] ${
        isSent ? 'ml-8' : ''
      }`}
      style={{
        borderLeftWidth: 2,
        borderLeftColor: railColor,
      }}
    >
      <div className="flex items-baseline gap-3 pl-3">
        <span
          className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.06em]"
          style={{ color: isSent ? '#E8B86D' : '#71717A' }}
        >
          {isSent ? 'Du →' : '→ Dir'}
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-[13px] leading-tight ${
            email.isRead || isSent ? 'text-ink-200' : 'font-medium text-ink-50'
          }`}
        >
          {email.subject || '(kein Betreff)'}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-[#52525B]">
          {formatTime(email.receivedAt)}
        </span>
      </div>
      {email.preview && (
        <p className="mt-1 truncate pl-3 text-[12px] leading-tight text-[#71717A]">
          {email.preview}
        </p>
      )}
      {isSent && email.awaitsTheirReply && (
        <p
          className="mt-1 pl-3 font-mono text-[10px] uppercase tracking-[0.06em]"
          style={{ color: '#E8B86D' }}
        >
          Noch keine Antwort
        </p>
      )}
    </Link>
  );
}

function bucketByMonth(emails: PersonEmail[]): {
  key: string;
  label: string;
  items: PersonEmail[];
}[] {
  const out: { key: string; label: string; items: PersonEmail[] }[] = [];
  let currentKey: string | null = null;
  for (const e of emails) {
    const d = new Date(e.receivedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== currentKey) {
      currentKey = key;
      out.push({
        key,
        label: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
        items: [],
      });
    }
    out[out.length - 1].items.push(e);
  }
  return out;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
