import { Eyebrow, Section } from './primitives';
import { Reveal } from './reveal';

/**
 * Wedge 3 — Der Morgen-Plan (Synthese über alle Quellen). Der Clou: nicht nur
 * was ansteht, sondern was KOLLIDIERT. Visual = der zusammengerechnete Plan.
 */
export function WedgeMorningPlan() {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <Eyebrow>Der Morgen-Plan</Eyebrow>
          <h2 className="mt-4 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink-50 sm:text-[40px]">
            Ein Screen. Dein ganzer Tag.
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-200 sm:text-[17px]">
            Fällige Zusagen, wartende Kunden, Termine, offene Tasks — zusammengerechnet
            über alle Quellen. Ctrl+K sagt dir nicht nur, was ansteht, sondern was
            kollidiert: „Zusage X fällig, aber Termin Y blockiert den Vormittag.“
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <MorningPlanMock />
        </Reveal>
      </div>
    </Section>
  );
}

function MorningPlanMock() {
  const rows = [
    { label: 'Wartet', value: '2 auf dich · 1 du wartest', tone: 'accent' as const },
    { label: 'Zusagen', value: '1 offen · 1 fällig heute', tone: 'warn' as const },
    { label: 'Termine', value: '09:00 Kickoff · 14:00 Review', tone: 'normal' as const },
    { label: 'Todos', value: '3 fällig heute', tone: 'normal' as const },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-ink-700/50 p-5 shadow-panel">
      <p className="mb-4 font-display text-[15px] font-medium text-ink-50">
        Guten Morgen. Heute hast du das hier.
      </p>

      <div className="flex flex-col">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex items-center gap-4 py-2.5 ${
              i < rows.length - 1 ? 'border-b border-white/[0.05]' : ''
            }`}
          >
            <span className="w-16 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-300">
              {r.label}
            </span>
            <span
              className={`flex-1 text-[13.5px] ${
                r.tone === 'accent'
                  ? 'text-accent'
                  : r.tone === 'warn'
                    ? 'text-[#E8B86D]'
                    : 'text-ink-100'
              }`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {/* Kollisions-Hinweis — das Synthese-Argument, gelb als einzelnes Highlight. */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent-yellow/20 bg-accent-yellow/[0.06] p-3.5">
        <span aria-hidden className="mt-px text-[13px] text-accent-yellow">
          ⚠
        </span>
        <p className="text-[12.5px] leading-relaxed text-ink-100">
          Zusage „Angebot an Maria“ ist heute fällig — aber dein Vormittag ist bis
          12:00 durch Termine blockiert.
        </p>
      </div>
    </div>
  );
}
