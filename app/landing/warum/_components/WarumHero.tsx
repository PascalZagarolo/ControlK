import { Eyebrow } from '@/components/marketing/primitives';

/**
 * Hero der „Warum“-Seite. Bewusst ruhig: kein CTA-Druck, kein Produkt-Visual.
 * Der Text rendert statisch (kein Reveal/opacity:0), damit das LCP-Element
 * sofort sichtbar ist.
 */
export function WarumHero() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-5 pb-10 pt-24 sm:px-8 sm:pb-14 sm:pt-32">
      {/* Einzelner, sehr zurückhaltender Lichtschein — kein Gradient-Soup. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[380px] max-w-3xl opacity-60"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 0%, rgba(139,127,255,0.13) 0%, rgba(139,127,255,0) 70%)',
        }}
      />

      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Warum Ctrl+K</Eyebrow>

        <h1 className="mt-5 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink-50 sm:text-[48px]">
          Die meisten Tools organisieren deinen Tag.
          <br className="hidden sm:block" />{' '}
          <span className="text-ink-300">Sie erledigen ihn nicht.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl font-body text-[16px] leading-relaxed text-ink-200 sm:text-[18px]">
          Notizen-Apps, Mail-Clients, Task-Manager — alle versprechen, dass du nur
          noch eine App brauchst. Und am Ende verbringst du mehr Zeit damit, das
          System zu pflegen, als damit zu arbeiten. Ctrl+K dreht das um.
        </p>
      </div>
    </section>
  );
}
