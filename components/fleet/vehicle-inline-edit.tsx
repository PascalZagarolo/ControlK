'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateVehicleField } from '@/lib/actions/vehicles';

type Field =
  | 'plate'
  | 'model'
  | 'kind'
  | 'status'
  | 'location'
  | 'km'
  | 'nextService'
  | 'lastInspection'
  | 'notes'
  | 'dailyRateCents'
  | 'weekendSurchargeCents'
  | 'acquisitionCents'
  | 'monthlyFixedCostsCents'
  | 'serviceIntervalKm'
  | 'serviceIntervalDays'
  | 'lastServiceKm';

export function VehicleInlineEdit({
  vehicleId,
  field,
  value,
  placeholder,
  multiline,
  inputType = 'text',
}: {
  vehicleId: string;
  field: Field;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  inputType?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select?.();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() === value.trim()) return;
    start(async () => {
      const res = await updateVehicleField({ vehicleId, field, value: draft });
      if (!res.ok) setDraft(value);
      router.refresh();
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Klick zum Bearbeiten"
        className="block w-full text-left"
      >
        <span className={value ? '' : 'text-ink-300'}>
          {value || placeholder || '— leer —'}
        </span>
      </button>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        disabled={pending}
        rows={4}
        className="w-full resize-none rounded-[6px] border border-white/[0.18] bg-white/[0.04] px-2.5 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.30]"
        placeholder={placeholder}
      />
    );
  }
  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      value={draft}
      type={inputType}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      disabled={pending}
      className="w-full rounded-[6px] border border-white/[0.18] bg-white/[0.04] px-2 py-1 text-[13px] text-ink-50 outline-none focus:border-white/[0.30]"
      placeholder={placeholder}
    />
  );
}
