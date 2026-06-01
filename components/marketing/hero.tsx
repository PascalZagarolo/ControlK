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
      {/* Zurückhaltender Lichtschein hinter dem Hero — der violette Brand-
          Akzent oben, ein zarter Sand/Gold-Schimmer (die Produkt-Signalfarbe
          für „jetzt fällig") darunter. Kein Gradient-Soup. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[460px] max-w-3xl opacity-70"
        style={{
          background:
            'radial-gradient(58% 56% at 50% 0%, rgba(139,127,255,0.15) 0%, rgba(139,127,255,0) 62%), radial-gradient(40% 40% at 50% 38%, rgba(232,184,109,0.07) 0%, rgba(232,184,109,0) 70%)',
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

      {/* Produkt-Visual: echter Morgen-Plan-Nachbau mit den echten Tokens der
          App (Sand/Gold nur für den fälligen Eintrag, Kollisions-Hinweis gelb).
          Kein toter Screenshot-Platzhalter mehr — zeigt das reale Designbild. */}
      <Reveal delay={0.1} className="mx-auto mt-14 max-w-3xl sm:mt-20">
        <WindowFrame label="ctrlk.de · Morgen-Plan">
          <HeroMorningPlan />
        </WindowFrame>
      </Reveal>
    </section>
  );
}

/**
 * Statischer Morgen-Plan-Nachbau für das Hero-Visual — bewusst an die echte
 * App gebunden: gedämpfte Kicker, der EINE fällige Eintrag in Sand/Gold, ein
 * überfälliger in Rot, ein Kollisions-Hinweis in Gelb. Spiegelt die
 * Priorisierungs- + Kollisions-Logik des Produkts, ohne etwas zu erfinden.
 */
function HeroMorningPlan() {
  const items = [
    { kicker: 'Zusage · überfällig', title: 'Angebot an Maria schicken', meta: '2 Tage überfällig', color: '#ff8a8a' },
    { kicker: 'Zusage · heute fällig', title: 'Entwurf an Müller GmbH', meta: 'fällig heute', color: '#E8B86D' },
    { kicker: 'Braucht Antwort', title: 'Thomas K.', meta: 'wartet seit 4 Tagen', color: '#5E9EFF' },
    { kicker: 'Termin', title: '09:00 Kickoff', meta: 'in 2 Std', color: '#5ee08a' },
  ];
  return (
    <div className="flex flex-col gap-3 text-left">
      <p className="font-display text-[15px] font-medium text-ink-50">
        Guten Morgen. Drei Dinge brauchen heute deine Aufmerksamkeit.
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => (
          <li
            key={it.title}
            className="flex items-stretch overflow-hidden rounded-xl border border-white/[0.06] bg-ink-900/40"
          >
            <span aria-hidden className="w-[3px] shrink-0" style={{ background: it.color }} />
            <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p
                  className="font-mono text-[9.5px] uppercase tracking-[0.3px]"
                  style={{ color: it.color }}
                >
                  {it.kicker}
                </p>
                <p className="mt-0.5 truncate text-[13.5px] font-medium text-ink-50">{it.title}</p>
              </div>
              <span className="shrink-0 font-mono text-[10.5px]" style={{ color: it.color }}>
                {it.meta}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {/* Kollisions-Hinweis — gelb als einzelnes Highlight, wie im Produkt. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-accent-yellow/20 bg-accent-yellow/[0.06] p-3">
        <span aria-hidden className="mt-px text-[12px] text-accent-yellow">⚠</span>
        <p className="text-[12px] leading-relaxed text-ink-100">
          „Entwurf an Müller GmbH“ ist heute fällig — aber dein Vormittag ist bis 12:00
          durch Termine blockiert.
        </p>
      </div>
    </div>
  );
}
