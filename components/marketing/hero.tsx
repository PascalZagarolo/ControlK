import { CTA, Eyebrow, WindowFrame } from './primitives';
import { Reveal } from './reveal';

/**
 * Hero — gesperrte Kernbotschaft. Der Text rendert statisch (kein Reveal,
 * kein opacity:0), damit das LCP-Element sofort sichtbar ist. Nur das
 * Produkt-Visual unter dem Text bekommt ein dezentes Einblenden.
 */
export function Hero() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 pb-12 pt-24 sm:px-8 sm:pb-16 sm:pt-32">
      {/* Sehr zurückhaltender, einzelner Lichtschein hinter dem Hero —
          kein Blob, kein Gradient-Soup: ein weicher radialer Akzent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[420px] max-w-3xl opacity-60"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, rgba(139,127,255,0.14) 0%, rgba(139,127,255,0) 70%)',
        }}
      />

      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Für Freelancer, Agenturen und Berater</Eyebrow>

        <h1 className="mt-5 font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink-50 sm:text-[52px]">
          Plane deinen Tag um die Zusagen herum, die du sonst{' '}
          <span className="text-accent">fallen lässt</span>.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink-200 sm:text-[18px]">
          Ctrl+K liest deine Mails, deinen Kalender und deine offenen Versprechen —
          und baut daraus den einen Plan, den keine dieser Apps allein bauen kann.
          Du guckst morgens rein und bist fertig.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CTA href="/sign-up" variant="primary" className="w-full sm:w-auto">
            Kostenlos starten
          </CTA>
          <CTA href="#wie-es-funktioniert" variant="ghost" className="w-full sm:w-auto">
            So funktioniert&apos;s
          </CTA>
        </div>
      </div>

      {/* Produkt-Visual: PLATZHALTER für echten Screenshot des Morgen-Plans.
          TODO(Pascal): echtes Bild des Morgen-Plans einsetzen. Bis dahin ein
          ehrlicher, leerer Rahmen — KEIN erfundener Feature-Inhalt. */}
      <Reveal delay={0.1} className="mx-auto mt-14 max-w-4xl sm:mt-20">
        <WindowFrame label="ctrlk.de · Morgen-Plan">
          <div className="flex aspect-[16/10] items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-ink-900/40">
            <span className="font-mono text-[12px] tracking-[0.04em] text-ink-300">
              [ Produkt-Screenshot: Morgen-Plan ]
            </span>
          </div>
        </WindowFrame>
      </Reveal>
    </section>
  );
}
