import { Eyebrow, Section } from './primitives';
import { Reveal } from './reveal';

/**
 * Wedge 1 — Zusagen-Tracking. Die prominenteste Beweis-Sektion: der Grund
 * zu zahlen kommt vor der Verpackung. Das Visual ist eine faithful Mock-Karte
 * des echten Promise-Trackers (Quell-Satz + Frist + Status) — die Features
 * existieren, das hier ist nur die illustrative Darstellung.
 */
export function WedgeCommitments() {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <Eyebrow>Zusagen-Tracking</Eyebrow>
          <h2 className="mt-4 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink-50 sm:text-[40px]">
            Es weiß, was du versprochen hast.
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-200 sm:text-[17px]">
            Ctrl+K scannt deine gesendeten Mails, erkennt Zusagen mit Fristen und
            konfrontiert dich morgens damit — bevor sie überfällig werden, nicht
            danach. Unsichere Zusagen fragt es nach, statt sie zu behaupten.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <CommitmentCardMock />
        </Reveal>
      </div>
    </Section>
  );
}

/** Illustrative Zusagen-Karte — spiegelt den echten Promise-Tracker. */
function CommitmentCardMock() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-ink-700/50 p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-200">
          <span aria-hidden>🤝</span> Offene Zusagen
        </span>
        <span className="font-mono text-[10.5px] text-ink-300">2 offen</span>
      </div>

      {/* Feste Zusage mit Quell-Satz — das „warum ist das hier“-Element. */}
      <div className="rounded-xl border border-white/[0.07] bg-ink-900/50 p-4">
        <p className="text-[14px] font-medium text-ink-50">Angebot schicken</p>
        <p className="mt-2 border-l-2 border-accent/40 pl-3 text-[12.5px] italic leading-relaxed text-ink-300">
          Du hast geschrieben: „Ich schicke dir das Angebot bis Freitag.“
        </p>
        <div className="mt-3 flex items-center gap-2 text-[12px]">
          <span className="text-[#5ee08a]">Maria Brandt</span>
          <span aria-hidden className="text-ink-500">·</span>
          <span className="text-[#E8B86D]">fällig in 2 Tagen</span>
        </div>
      </div>

      {/* Unsichere Zusage — wird nachgefragt, nicht behauptet. */}
      <div className="mt-3 rounded-xl border border-dashed border-white/[0.09] bg-ink-900/30 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <span aria-hidden className="text-[11px]">❓</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-300">
            Mögliche Zusage · bitte bestätigen
          </span>
        </div>
        <p className="text-[14px] text-ink-100">Entwurf bis nächste Woche</p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-md border border-accent/30 bg-accent-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
            Ist Zusage
          </span>
          <span className="rounded-md border border-white/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
            Verwerfen
          </span>
        </div>
      </div>
    </div>
  );
}
