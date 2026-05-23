'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar } from '@/components/channel/avatar';
import { updateCustomerField } from '@/lib/actions/customers';
import type { Customer, CustomerStatus } from '@/lib/types';

const STAGES: { key: CustomerStatus; label: string; color: string; hint: string }[] = [
  { key: 'lead', label: 'Leads', color: '#5eb6ff', hint: 'Interessenten / Akquise' },
  { key: 'aktiv', label: 'Aktive Kunden', color: '#5ee08a', hint: 'Laufende Verträge' },
  { key: 'inaktiv', label: 'Inaktive', color: '#7d7d7d', hint: 'Keine aktiven Verträge' },
];

function fmtEur(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function CustomerFunnelView({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<CustomerStatus | null>(null);

  const grouped = new Map<CustomerStatus, Customer[]>();
  for (const stage of STAGES) grouped.set(stage.key, []);
  for (const c of customers) grouped.get(c.status)?.push(c);

  const handleDrop = (status: CustomerStatus) => {
    if (!draggingId) return;
    const customer = customers.find((c) => (c.dbId ?? c.id) === draggingId);
    if (!customer || customer.status === status) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    const dbId = customer.dbId;
    if (!dbId) return;
    start(async () => {
      await updateCustomerField({ customerId: dbId, field: 'status', value: status });
      router.refresh();
    });
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {STAGES.map((stage) => {
        const items = grouped.get(stage.key) ?? [];
        const total = items.reduce(
          (acc, c) => acc + (c.forecast?.activeMrcCents ?? 0),
          0
        );
        const isTarget = dropTarget === stage.key;
        return (
          <div
            key={stage.key}
            onDragOver={(e) => {
              e.preventDefault();
              if (dropTarget !== stage.key) setDropTarget(stage.key);
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={() => handleDrop(stage.key)}
            className={`flex flex-col gap-2 rounded-[14px] border bg-white/[0.02] p-3 transition-colors ${
              isTarget ? 'border-[#5eb6ff]/40 bg-[#5eb6ff]/[0.05]' : 'border-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: stage.color }}
                />
                <h3 className="text-[13px] font-medium text-ink-50">{stage.label}</h3>
                <span className="font-mono text-[10px] text-ink-300">{items.length}</span>
              </div>
              {total > 0 && (
                <span className="font-mono text-[10.5px] tabular-nums text-ink-200">
                  {fmtEur(total)}
                </span>
              )}
            </div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
              {stage.hint}
            </p>
            <div className="flex flex-col gap-1.5">
              {items.length === 0 && (
                <p className="rounded-[8px] border border-dashed border-white/[0.08] py-4 text-center text-[11px] text-ink-300">
                  Drag a customer here
                </p>
              )}
              {items.map((c) => (
                <div
                  key={c.dbId ?? c.id}
                  draggable
                  onDragStart={() => setDraggingId(c.dbId ?? c.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTarget(null);
                  }}
                  className={`group cursor-grab transition-opacity ${
                    draggingId === (c.dbId ?? c.id) ? 'opacity-40' : ''
                  } ${pending ? 'pointer-events-none' : ''}`}
                >
                  <Link
                    href={`/kunden/${c.id}`}
                    onClick={(e) => {
                      if (draggingId) e.preventDefault();
                    }}
                    className="flex items-center gap-2 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
                  >
                    <Avatar initials={c.initials} from={c.from} to={c.to} size={20} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink-50">
                      {c.name}
                    </span>
                    {c.forecast && c.forecast.activeMrcCents > 0 && (
                      <span className="font-mono text-[10px] tabular-nums text-ink-300">
                        {fmtEur(c.forecast.activeMrcCents)}
                      </span>
                    )}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
