import Link from 'next/link';

export function ComingSoon({ view }: { view: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
        {view}-Ansicht
      </span>
      <h2 className="text-[18px] font-medium text-ink-50">
        Kommt in Phase 2b.
      </h2>
      <p className="max-w-[360px] text-[13px] leading-[1.55] text-ink-300">
        V1 hat die Wochen-Ansicht. Tag, Monat und Agenda werden nach dem
        Wochen-View und dem Termin-Erstellen-Flow nachgezogen.
      </p>
      <Link
        href="/calendar/week"
        className="mt-2 rounded-md border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-ink-50 transition-colors hover:bg-white/[0.08]"
      >
        Zur Wochen-Ansicht
      </Link>
    </div>
  );
}
