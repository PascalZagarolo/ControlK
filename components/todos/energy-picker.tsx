'use client';

import { useState, useTransition } from 'react';
import { setTodoEnergy } from '@/lib/actions/todos';
import type { TodoEnergy } from '@/lib/types';

export const ENERGY_META: Record<
  TodoEnergy,
  { icon: string; label: string; color: string; description: string }
> = {
  deep: { icon: '🧠', label: 'Deep', color: '#a78bfa', description: 'Konzentrierte Arbeit, mind. 45min' },
  light: { icon: '💡', label: 'Light', color: '#5eb6ff', description: 'Leichte Arbeit, jederzeit machbar' },
  call: { icon: '☎', label: 'Call', color: '#5ee08a', description: 'Telefonat / Video-Call' },
  admin: { icon: '📋', label: 'Admin', color: '#ffd96a', description: 'Verwaltung, Mails, Klein-Kram' },
  quick: { icon: '⚡', label: 'Quick', color: '#ff8a8a', description: 'Unter 5 min, sofort erledigen' },
};

const ALL: TodoEnergy[] = ['deep', 'light', 'call', 'admin', 'quick'];

export function EnergyBadge({ energy }: { energy: TodoEnergy }) {
  const m = ENERGY_META[energy];
  return (
    <span
      title={`${m.label} — ${m.description}`}
      className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px]"
      style={{ background: `${m.color}1a`, color: m.color }}
    >
      {m.icon}
    </span>
  );
}

export function EnergyPicker({
  todoId,
  current,
}: {
  todoId: string;
  current?: TodoEnergy;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const pick = (e: TodoEnergy | null) => {
    setOpen(false);
    start(async () => {
      await setTodoEnergy(todoId, e);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1.5 rounded-[6px] border border-white/[0.06] bg-white/[0.02] px-2 text-[12px] text-ink-200 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
      >
        {current ? (
          <>
            <EnergyBadge energy={current} />
            <span>{ENERGY_META[current].label}</span>
          </>
        ) : (
          <span className="text-ink-300">Energy</span>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-40 mt-1 min-w-[180px] rounded-[8px] border border-white/[0.08] bg-[#16181d] p-1 shadow-lg">
            {ALL.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pick(e)}
                disabled={pending}
                className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-white/[0.04] ${
                  current === e ? 'bg-white/[0.04]' : ''
                }`}
              >
                <EnergyBadge energy={e} />
                <span className="flex-1 text-ink-100">{ENERGY_META[e].label}</span>
                <span className="text-[10.5px] text-ink-300">{ENERGY_META[e].description}</span>
              </button>
            ))}
            {current && (
              <>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  type="button"
                  onClick={() => pick(null)}
                  disabled={pending}
                  className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink-300 transition-colors hover:bg-white/[0.04]"
                >
                  ∅ Tag entfernen
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
