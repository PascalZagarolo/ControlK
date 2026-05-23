'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createVehicleTag,
  deleteVehicleTag,
  setVehicleTags,
} from '@/lib/actions/vehicles';
import type { VehicleTag } from '@/lib/types';

const COLOR_PRESETS = [
  '#5eb6ff',
  '#5ee08a',
  '#ffd96a',
  '#ff8a8a',
  '#c084fc',
  '#f472b6',
  '#ffb45e',
  '#9c9c9d',
];

export function VehicleTagBadge({
  tag,
  removable,
  onRemove,
}: {
  tag: VehicleTag;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const color = tag.color ?? '#9c9c9d';
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded-[4px] px-1.5 text-[10.5px] font-medium"
      style={{ background: `${color}24`, color: '#e6e7ec', boxShadow: `inset 0 0 0 1px ${color}55` }}
    >
      <span className="inline-block h-1 w-1 rounded-full" style={{ background: color }} />
      {tag.name}
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 text-ink-300 hover:text-ink-50"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function VehicleTagPicker({
  vehicleId,
  current,
  all,
}: {
  vehicleId: string;
  current: VehicleTag[];
  all: VehicleTag[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLOR_PRESETS[0]);

  const currentIds = new Set(current.map((t) => t.id));

  const toggle = (tagId: string) => {
    const nextIds = currentIds.has(tagId)
      ? Array.from(currentIds).filter((i) => i !== tagId)
      : [...Array.from(currentIds), tagId];
    start(async () => {
      await setVehicleTags({ vehicleId, tagIds: nextIds });
      router.refresh();
    });
  };

  const createAndAssign = () => {
    if (!newTagName.trim()) return;
    start(async () => {
      const res = await createVehicleTag({ name: newTagName.trim(), color: newTagColor });
      if (res.ok) {
        await setVehicleTags({
          vehicleId,
          tagIds: [...Array.from(currentIds), res.id],
        });
        setNewTagName('');
        router.refresh();
      }
    });
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1">
        {current.map((t) => (
          <VehicleTagBadge
            key={t.id}
            tag={t}
            removable
            onRemove={() =>
              start(async () => {
                const nextIds = Array.from(currentIds).filter((i) => i !== t.id);
                await setVehicleTags({ vehicleId, tagIds: nextIds });
                router.refresh();
              })
            }
          />
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-[4px] border border-dashed border-white/[0.18] px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 hover:border-white/[0.32] hover:text-ink-50"
        >
          + Tag
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1 w-[260px] rounded-[10px] border border-white/[0.08] bg-[#16181d] p-2 shadow-lg">
            <div className="flex flex-col gap-0.5">
              {all.map((t) => {
                const checked = currentIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    className="group flex items-center gap-2 rounded-[6px] px-2 py-1.5 hover:bg-white/[0.04]"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      disabled={pending}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
                          checked
                            ? 'border-[#5eb6ff] bg-[#5eb6ff]/15'
                            : 'border-white/[0.18]'
                        }`}
                      >
                        {checked && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#5eb6ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        )}
                      </span>
                      <VehicleTagBadge tag={t} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        start(async () => {
                          await deleteVehicleTag(t.id);
                          router.refresh();
                        })
                      }
                      className="opacity-0 transition-opacity hover:text-[#ff8a8a] group-hover:opacity-100"
                    >
                      <span className="font-mono text-[11px] text-ink-300">×</span>
                    </button>
                  </div>
                );
              })}
              {all.length === 0 && (
                <p className="px-2 py-2 text-[11px] text-ink-300">
                  Noch keine Tags.
                </p>
              )}
            </div>
            <div className="mt-2 border-t border-white/[0.06] pt-2">
              <p className="mb-1 px-2 font-mono text-[9px] uppercase tracking-[0.4px] text-ink-300">
                Neuer Tag
              </p>
              <div className="flex items-center gap-1 px-1">
                <input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="z.B. Premium"
                  className="min-w-0 flex-1 rounded-[4px] border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11.5px] text-ink-50 outline-none focus:border-white/[0.20]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      createAndAssign();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={createAndAssign}
                  disabled={!newTagName.trim() || pending}
                  className="rounded-[4px] bg-white px-2 py-1 text-[11px] font-medium text-black disabled:opacity-30"
                >
                  +
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1 px-1">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`h-4 w-4 rounded-full border-2 ${
                      newTagColor === c ? 'border-white/40' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
