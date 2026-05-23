'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { joinViaInvite } from '@/lib/actions/workspace';

export function InviteAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await joinViaInvite(token);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.push('/');
          router.refresh();
        });
      }}
      className="flex w-full flex-col gap-3"
    >
      {error && (
        <div className="rounded-[10px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] px-3 py-2 text-[12px] text-[#ff8a8a]">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[10px] bg-[#5eb6ff] px-4 py-3 text-[14px] font-medium leading-none text-black hover:bg-[#5eb6ff]/90 disabled:opacity-40"
      >
        {pending ? 'Beitritt läuft …' : '✓ Workspace beitreten'}
      </button>
    </form>
  );
}
