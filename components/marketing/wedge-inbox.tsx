import { Eyebrow, Section } from './primitives';
import { Reveal } from './reveal';

/**
 * Wedge 2 — Kundenzentrierte Inbox. „Wer wartet auf mich?“ statt „was kam
 * zuletzt rein?“. Visual = faithful Mock der „Nach Kunde / Wartet“-Ansicht.
 * Bild links, Text rechts (alternierendes Layout zum Rhythmus).
 */
export function WedgeInbox() {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal delay={0.1} className="order-last lg:order-first">
          <InboxByCustomerMock />
        </Reveal>

        <Reveal>
          <Eyebrow>Kundenzentrierte Inbox</Eyebrow>
          <h2 className="mt-4 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink-50 sm:text-[40px]">
            Deine Inbox, nach Kunden sortiert. Nicht nach Uhrzeit.
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-200 sm:text-[17px]">
            „Wer wartet auf mich?“ statt „was kam zuletzt rein?“. Sieh auf einen Blick,
            welcher Kunde seit wann auf eine Antwort wartet — und antworte, bevor es
            einer merkt.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

function InboxByCustomerMock() {
  const rows = [
    { initials: 'MB', name: 'Maria Brandt', waited: 'wartet seit 3 Tagen', urgent: true },
    { initials: 'JK', name: 'Jonas Keller', waited: 'wartet seit 1 Tag', urgent: false },
    { initials: 'SW', name: 'Studio Weber', waited: 'wartet seit 4 Std', urgent: false },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-ink-700/50 p-5 shadow-panel">
      <div className="mb-4 flex items-center gap-1">
        {['Nach Kunde', 'Wartet', 'Chronologisch'].map((t, i) => (
          <span
            key={t}
            className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${
              i === 0 ? 'bg-white/[0.08] text-ink-50' : 'text-ink-300'
            }`}
          >
            {t}
          </span>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-white/[0.05]">
        {rows.map((r) => (
          <li key={r.initials} className="flex items-center gap-3 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[11px] text-ink-100">
              {r.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] text-ink-50">{r.name}</span>
              <span
                className={`text-[11.5px] ${r.urgent ? 'text-[#ff8a8a]' : 'text-ink-300'}`}
              >
                {r.waited}
              </span>
            </span>
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: r.urgent ? '#ff8a8a' : '#5ee08a' }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
