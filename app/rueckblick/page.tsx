import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getWeeklyReview, type ReviewCommitment } from '@/lib/db/queries/weekly-review';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wochen-Rückblick' };

// Calm weekly recap: what you held, what's slipping. Closes the loop the
// morning plan opens. Hierarchy via type + space, real tokens, honest states.
const C = {
  bg: '#0A0A0C', fg: '#F0F0F2', muted: '#9c9c9d', faint: '#7c7c83',
  hair: 'rgba(255,255,255,0.06)', panel: 'rgba(255,255,255,0.02)',
  held: '#5ee08a', overdue: '#ff8a8a', calm: '#52525B',
};

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/rueckblick');
  const ws = await requireCurrentWorkspace();
  const r = await getWeeklyReview(ws.id, user.id);

  const headline =
    r.heldCount > 0
      ? `${r.heldCount} ${r.heldCount === 1 ? 'Zusage' : 'Zusagen'} diese Woche gehalten.`
      : r.slippingCount > 0
        ? 'Diese Woche wurde noch keine Zusage abgehakt.'
        : 'Ruhige Woche — nichts Offenes kippt gerade.';

  return (
    <main className="min-h-screen" style={{ background: C.bg, color: C.fg }}>
      <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-24 sm:px-8">
        <header className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: C.faint }}>
            Letzte 7 Tage
          </span>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] sm:text-[30px]">{headline}</h1>
          <p className="text-[13px]" style={{ color: C.faint }}>
            {r.repliesSent} {r.repliesSent === 1 ? 'Antwort' : 'Antworten'} gesendet ·{' '}
            {r.newPromises} {r.newPromises === 1 ? 'neue Zusage' : 'neue Zusagen'} erkannt
          </p>
        </header>

        <Section title="Gehalten" count={r.heldCount} empty="Diese Woche noch nichts abgehakt — kein Drama, der Plan zeigt dir, was als Nächstes dran ist.">
          {r.held.map((c) => (
            <Row key={c.id} c={c} tone="held" />
          ))}
        </Section>

        <Section title="Kippt / überfällig" count={r.slippingCount} empty="Nichts überfällig — alle offenen Zusagen sind im Zeitplan.">
          {r.slipping.map((c) => (
            <Row key={c.id} c={c} tone="overdue" />
          ))}
        </Section>
      </div>
    </main>
  );
}

function Section({
  title, count, empty, children,
}: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>{title}</h2>
        {count > 0 && <span className="font-mono text-[11px]" style={{ color: C.calm }}>{count}</span>}
      </div>
      {count === 0 ? (
        <p className="text-[13px]" style={{ color: C.calm }}>{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">{children}</ul>
      )}
    </section>
  );
}

function Row({ c, tone }: { c: ReviewCommitment; tone: 'held' | 'overdue' }) {
  const accent = tone === 'held' ? C.held : C.overdue;
  return (
    <li className="flex items-start gap-3 rounded-xl border px-3.5 py-2.5" style={{ borderColor: C.hair, background: C.panel }}>
      <span aria-hidden className="mt-[3px] text-[12px]" style={{ color: accent }}>
        {tone === 'held' ? '✓' : '!'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px]" style={{ color: C.fg }}>{c.promiseText}</p>
        <p className="mt-0.5 text-[11.5px]" style={{ color: C.faint }}>
          {c.who ? `${c.who} · ` : ''}
          {tone === 'overdue' && c.overdueDays !== null
            ? `${c.overdueDays} ${c.overdueDays === 1 ? 'Tag' : 'Tage'} überfällig`
            : 'erledigt'}
        </p>
      </div>
    </li>
  );
}
