'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { STATUS_META } from './status-pill';
import { updateContractField } from '@/lib/actions/contracts';
import type { Contract, ContractStatus } from '@/lib/types';

const STAGES: { key: ContractStatus; hint: string }[] = [
  { key: 'entwurf', hint: 'Im Entstehen' },
  { key: 'aktiv', hint: 'Laufende Verträge' },
  { key: 'auslaufend', hint: 'Ablaufend in 30d' },
  { key: 'storniert', hint: 'Beendet' },
];

function fmtEur(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function ContractFunnel({ contracts }: { contracts: Contract[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ContractStatus | null>(null);

  const grouped = new Map<ContractStatus, Contract[]>();
  for (const stage of STAGES) grouped.set(stage.key, []);
  for (const c of contracts) {
    if (grouped.has(c.status)) grouped.get(c.status)!.push(c);
  }

  const handleDrop = (status: ContractStatus) => {
    if (!draggingId) return;
    const contract = contracts.find((c) => (c.dbId ?? c.id) === draggingId);
    if (!contract || contract.status === status || !contract.dbId) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }
    start(async () => {
      await updateContractField({ contractId: contract.dbId!, field: 'status', value: status });
      router.refresh();
    });
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {STAGES.map((stage) => {
        const items = grouped.get(stage.key) ?? [];
        const total = items.reduce((acc, c) => acc + (c.valueCents ?? 0), 0);
        const meta = STATUS_META[stage.key];
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
                  style={{ background: meta.color }}
                />
                <h3 className="text-[13px] font-medium text-ink-50">{meta.label}</h3>
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
                  Hier ziehen
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
                  className={`cursor-grab transition-opacity ${
                    draggingId === (c.dbId ?? c.id) ? 'opacity-40' : ''
                  } ${pending ? 'pointer-events-none' : ''}`}
                >
                  <Link
                    href={`/vertraege/${c.id}`}
                    onClick={(e) => draggingId && e.preventDefault()}
                    className="block rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
                  >
                    <p className="truncate text-[12.5px] font-medium text-ink-50">{c.title}</p>
                    <p className="mt-0.5 truncate text-[10.5px] text-ink-300">
                      {c.customerName ?? '—'}
                    </p>
                    {(c.valueCents ?? 0) > 0 && (
                      <p className="mt-1 font-mono text-[10.5px] tabular-nums text-ink-200">
                        {c.value}
                      </p>
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
