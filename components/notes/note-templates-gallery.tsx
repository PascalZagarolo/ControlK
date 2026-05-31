'use client';

/**
 * "Neue Notiz aus Vorlage" — a small gallery over the workspace's note
 * templates (createNoteFromTemplate already exists server-side; this is the
 * missing surface). Picking a template creates the note and opens it.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createNoteFromTemplate } from '@/lib/actions/notes';
import { toast } from '@/lib/stores/toast-store';

export type NoteTemplateMeta = {
  key: string;
  title: string;
  icon: string;
  description: string;
};

export function NoteTemplatesGallery({ templates }: { templates: NoteTemplateMeta[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (templates.length === 0) return null;

  const pick = (key: string) => {
    start(async () => {
      const res = await createNoteFromTemplate({ templateKey: key });
      if (res.ok) {
        setOpen(false);
        router.push(`/notes/${res.id}`);
      } else {
        toast(res.error ?? 'Vorlage fehlgeschlagen', 'danger');
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 transition-colors hover:border-white/[0.18] hover:text-ink-50"
      >
        Aus Vorlage
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-[min(680px,calc(100vw-32px))] overflow-hidden rounded-[18px] border border-white/[0.08] bg-[rgba(14,15,18,0.97)] shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-ink-300">
                  Notiz aus Vorlage
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
                >
                  Esc
                </button>
              </div>
              <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
                {templates.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    disabled={pending}
                    onClick={() => pick(t.key)}
                    className="flex items-start gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-white/[0.16] hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    <span className="text-[20px] leading-none">{t.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-ink-50">{t.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-300">
                        {t.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
