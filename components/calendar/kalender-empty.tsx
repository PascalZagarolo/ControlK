'use client';

import { useState } from 'react';
import { Headline } from '@/components/ui/headline';
import { EmptyCreateCard } from '@/components/ui/empty-create-card';
import { CreateEventModal } from './create-event-modal';

export function KalenderEmpty() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 pb-32 pt-28">
      <Headline
        kicker="Kalender"
        title="Heute & Woche"
        subtitle="Übergaben, Rückgaben, interne Termine und Wartungen — alles auf einer Linie."
      />
      <div className="mt-12">
        <EmptyCreateCard
          title="Ersten Termin anlegen"
          subtitle="Übergabe, Rückgabe, internes Meeting oder Wartung — leg los."
          onClick={() => setOpen(true)}
        />
      </div>
      <CreateEventModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
