'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/channel/avatar';
import { bulkUpdateVehicles } from '@/lib/actions/vehicles';
import type { VehicleStatus, VehicleTag, TodoUser } from '@/lib/types';

export function FleetBulkBar({
  selectedIds,
  onClear,
  members,
  tags,
}: {
  selectedIds: string[];
  onClear: () => void;
  members: TodoUser[];
  tags: VehicleTag[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<'status' | 'owner' | 'tag' | null>(null);

  if (selectedIds.length === 0) return null;

  const apply = (update: Parameters<typeof bulkUpdateVehicles>[0]) => {
    start(async () => {
      await bulkUpdateVehicles(update);
      router.refresh();
      onClear();
      setOpen(null);
    });
  };

  return (
    <div className="sticky bottom-6 z-30 mx-auto flex w-fit items-center gap-2 rounded-full border border-white/[0.10] bg-[rgba(20,21,23,0.96)] px-3 py-2 shadow-xl backdrop-blur-md">
      <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-ink-100">
        {selectedIds.length} ausgewählt
      </span>
      <span className="text-ink-300">·</span>

      <Menu label="Status" open={open === 'status'} toggle={() => setOpen(open === 'status' ? null : 'status')}>
        {(['frei', 'vermietet', 'wartung', 'reserviert'] as VehicleStatus[]).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => apply({ vehicleIds: selectedIds, status: st })}
            className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-ink-100 hover:bg-white/[0.04]"
          >
            {st}
          </button>
        ))}
      </Menu>

      <Menu label="Owner" open={open === 'owner'} toggle={() => setOpen(open === 'owner' ? null : 'owner')}>
        <button
          type="button"
          onClick={() => apply({ vehicleIds: selectedIds, ownerId: null })}
          className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink-300 hover:bg-white/[0.04]"
        >
          ∅ Niemand
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => apply({ vehicleIds: selectedIds, ownerId: m.id })}
            className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-ink-100 hover:bg-white/[0.04]"
          >
            <Avatar initials={m.initials} from={m.from} to={m.to} size={18} />
            <span className="flex-1 truncate">{m.name}</span>
          </button>
        ))}
      </Menu>

      <Menu label="Tag +" open={open === 'tag'} toggle={() => setOpen(open === 'tag' ? null : 'tag')}>
        {tags.length === 0 && (
          <p className="px-2 py-2 text-[11px] text-ink-300">Noch keine Tags.</p>
        )}
        {tags.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => apply({ vehicleIds: selectedIds, addTagIds: [t.id] })}
            className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink-100 hover:bg-white/[0.04]"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: t.color ?? '#9c9c9d' }}
            />
            <span className="flex-1 truncate">{t.name}</span>
          </button>
        ))}
      </Menu>

      <button
        type="button"
        onClick={onClear}
        disabled={pending}
        className="rounded-full px-3 py-1 text-[11.5px] text-ink-300 hover:text-ink-50"
      >
        Abbrechen
      </button>
    </div>
  );
}

function Menu({
  label,
  open,
  toggle,
  children,
}: {
  label: string;
  open: boolean;
  toggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className={`rounded-full border px-3 py-1 text-[11.5px] transition-colors ${
          open
            ? 'border-white/15 bg-white/[0.08] text-ink-50'
            : 'border-white/[0.06] bg-white/[0.02] text-ink-200 hover:border-white/[0.14] hover:text-ink-50'
        }`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 max-h-[280px] w-[200px] overflow-y-auto rounded-[10px] border border-white/[0.10] bg-[#16181d] p-1 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}
