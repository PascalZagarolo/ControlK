'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { convertMentionsToTodos } from '@/lib/actions/todos';

export function BulkCaptureButton({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          const res = await convertMentionsToTodos(channelId);
          if (!res.ok) {
            setFeedback(res.error);
            return;
          }
          if (res.created === 0) setFeedback('Keine ungelesenen @-Mentions.');
          else setFeedback(`${res.created} Todo${res.created === 1 ? '' : 's'} erstellt`);
          setTimeout(() => setFeedback(null), 3500);
          router.refresh();
        })
      }
      disabled={pending}
      title="Alle ungelesenen @-Mentions in Todos verwandeln"
      className="flex h-7 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 text-[12px] text-ink-200 transition-colors hover:border-white/[0.18] hover:bg-white/[0.05]"
    >
      <span>📋</span>
      <span>{pending ? 'Erstelle …' : feedback ?? 'Mentions → Todos'}</span>
    </button>
  );
}
