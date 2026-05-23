'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateContractField } from '@/lib/actions/contracts';
import type { Contract } from '@/lib/types';

function fmtEur(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function MarginCalculator({ contract }: { contract: Contract }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cId = contract.dbId ?? '';
  const [value, setValue] = useState(
    contract.valueCents != null ? String(contract.valueCents / 100) : ''
  );
  const [costs, setCosts] = useState(
    contract.estimatedCostsCents != null ? String(contract.estimatedCostsCents / 100) : ''
  );
  const [discount, setDiscount] = useState(
    contract.discountPct != null ? String(contract.discountPct) : ''
  );

  useEffect(() => {
    setValue(contract.valueCents != null ? String(contract.valueCents / 100) : '');
    setCosts(contract.estimatedCostsCents != null ? String(contract.estimatedCostsCents / 100) : '');
    setDiscount(contract.discountPct != null ? String(contract.discountPct) : '');
  }, [contract.valueCents, contract.estimatedCostsCents, contract.discountPct]);

  const valueCents = Math.round((parseFloat(value.replace(',', '.')) || 0) * 100);
  const costsCents = Math.round((parseFloat(costs.replace(',', '.')) || 0) * 100);
  const discountPct = Math.max(0, Math.min(100, parseInt(discount, 10) || 0));
  const discounted = Math.round(valueCents * (1 - discountPct / 100));
  const net = discounted - costsCents;
  const netPct = discounted > 0 ? (net / discounted) * 100 : 0;

  const persist = (field: 'value' | 'discountPct' | 'estimatedCostsCents', v: string) => {
    if (!cId) return;
    start(async () => {
      await updateContractField({ contractId: cId, field, value: v });
      router.refresh();
    });
  };

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Margin-Rechner
        </span>
        {pending && <span className="font-mono text-[10px] text-ink-300">speichere …</span>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Brutto-Wert €" value={value} onChange={setValue} onBlur={() => persist('value', value)} />
        <Field label="Rabatt %" value={discount} onChange={setDiscount} onBlur={() => persist('discountPct', discount)} max={100} />
        <Field
          label="Kosten €"
          value={costs}
          onChange={setCosts}
          onBlur={() => persist('estimatedCostsCents', costs)}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[8px] bg-white/[0.02] px-3 py-2">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">Net Margin</p>
          <p
            className="mt-0.5 font-mono text-[20px] tabular-nums"
            style={{ color: net > 0 ? '#5ee08a' : net < 0 ? '#ff8a8a' : '#9c9c9d' }}
          >
            {fmtEur(net)}
          </p>
        </div>
        <div className="rounded-[8px] bg-white/[0.02] px-3 py-2">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">Margin %</p>
          <p
            className="mt-0.5 font-mono text-[20px] tabular-nums"
            style={{ color: netPct > 20 ? '#5ee08a' : netPct > 0 ? '#ffd96a' : '#ff8a8a' }}
          >
            {netPct.toFixed(1)}%
          </p>
        </div>
      </div>
      <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
        Effektiver Wert nach Rabatt: {fmtEur(discounted)}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  max?: number;
}) {
  return (
    <div>
      <label className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        max={max}
        className="mt-1 block w-full rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] tabular-nums text-ink-50 outline-none focus:border-white/[0.20]"
      />
    </div>
  );
}
