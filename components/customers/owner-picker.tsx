'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/channel/avatar';
import { setCustomerOwner } from '@/lib/actions/customers';
import type { TodoUser } from '@/lib/types';

export function OwnerPicker({
  customerId,
  current,
  members,
}: {
  customerId: string;
  current?: TodoUser;
  members: TodoUser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const choose = (id: string | null) => {
    setOpen(false);
    start(async () => {
      await setCustomerOwner({ customerId, ownerId: id });
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Account-Owner setzen"
        className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11.5px] text-ink-200 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
      >
        {current ? (
          <>
            <Avatar initials={current.initials} from={current.from} to={current.to} size={18} />
            <span>{current.name}</span>
          </>
        ) : (
          <>
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-dashed border-white/[0.18] text-[10px] text-ink-300">
              ?
            </span>
            <span className="text-ink-300">Owner</span>
          </>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1 w-[220px] rounded-[10px] border border-white/[0.08] bg-[#16181d] p-1 shadow-lg">
            <button
              type="button"
              onClick={() => choose(null)}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink-300 hover:bg-white/[0.04]"
            >
              ∅ Niemand
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => choose(m.id)}
                disabled={pending}
                className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] hover:bg-white/[0.04] ${
                  current?.id === m.id ? 'bg-white/[0.04] text-ink-50' : 'text-ink-100'
                }`}
              >
                <Avatar initials={m.initials} from={m.from} to={m.to} size={20} />
                <span className="flex-1 truncate">{m.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
