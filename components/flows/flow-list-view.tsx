'use client';

/**
 * Flow — LIST view (the mandatory base; fully usable without the graph).
 *
 * Renders the flow's steps as a numbered sequence: active step highlighted,
 * done steps checked, upcoming steps dimmed ("noch nicht dran"). Add / remove
 * / reorder write into the same todo model the graph view uses.
 */
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  addFlowStep,
  toggleFlowStep,
  removeFlowStep,
  moveFlowStep,
  renameFlowNode,
} from '@/lib/actions/flows';
import { toast } from '@/lib/stores/toast-store';
import type { FlowStep } from '@/lib/flows/sequence';

const ACCENT = '#8B7FFF';

export function FlowListView({
  flowId,
  steps,
}: {
  flowId: string;
  steps: FlowStep[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error ?? 'Aktion fehlgeschlagen', 'danger');
      router.refresh();
    });

  return (
    <div className="flex flex-col">
      {steps.length === 0 ? (
        <p className="py-6 text-center text-[13px] italic text-[#52525B]">
          Noch keine Schritte. Füge den ersten unten hinzu.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {steps.map((step, i) => (
              <motion.li
                layout
                key={step.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="group flex items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-colors"
                style={{
                  borderColor: step.state === 'active' ? `${ACCENT}55` : 'rgba(255,255,255,0.06)',
                  background: step.state === 'active' ? `${ACCENT}14` : 'rgba(255,255,255,0.015)',
                  opacity: step.state === 'upcoming' ? 0.55 : 1,
                }}
              >
                {/* Index / connector */}
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[11px]"
                  style={{
                    background: step.state === 'done' ? `${ACCENT}22` : 'rgba(255,255,255,0.04)',
                    color: step.state === 'done' ? ACCENT : step.state === 'active' ? ACCENT : '#52525B',
                    border: step.state === 'active' ? `1px solid ${ACCENT}` : '1px solid transparent',
                  }}
                >
                  {step.state === 'done' ? '✓' : step.position}
                </span>

                {/* Checkbox toggle */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => toggleFlowStep(step.id))}
                  aria-label={step.state === 'done' ? 'Wieder öffnen' : 'Erledigt'}
                  className="shrink-0 text-[#52525B] transition-colors hover:text-[#FAFAFA] disabled:opacity-50"
                >
                  <Box checked={step.state === 'done'} />
                </button>

                {/* Title (inline-editable) */}
                {editingId === step.id ? (
                  <InlineEdit
                    initial={step.title}
                    onCommit={(title) => {
                      setEditingId(null);
                      if (title.trim() && title.trim() !== step.title) act(() => renameFlowNode(step.id, title));
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingId(step.id)}
                    className={`min-w-0 flex-1 truncate text-left text-[14px] ${
                      step.state === 'done'
                        ? 'text-[#52525B] line-through decoration-[#52525B]/40'
                        : 'text-[#FAFAFA]'
                    }`}
                  >
                    {step.title}
                    {step.state === 'active' && (
                      <span className="ml-2 font-mono text-[9.5px] uppercase tracking-[0.3px]" style={{ color: ACCENT }}>
                        jetzt dran
                      </span>
                    )}
                  </button>
                )}

                {/* Reorder + delete (hover) */}
                <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <IconBtn label="Hoch" disabled={pending || i === 0} onClick={() => act(() => moveFlowStep(step.id, 'up'))}>↑</IconBtn>
                  <IconBtn label="Runter" disabled={pending || i === steps.length - 1} onClick={() => act(() => moveFlowStep(step.id, 'down'))}>↓</IconBtn>
                  <IconBtn
                    label="Entfernen"
                    disabled={pending}
                    danger
                    onClick={() => {
                      if (confirm('Diesen Schritt entfernen?')) act(() => removeFlowStep(step.id));
                    }}
                  >
                    ×
                  </IconBtn>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}

      <AddStep flowId={flowId} onAdded={() => router.refresh()} />
    </div>
  );
}

function AddStep({ flowId, onAdded }: { flowId: string; onAdded: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    start(async () => {
      const r = await addFlowStep(flowId, t);
      if (r.ok) {
        setValue('');
        requestAnimationFrame(() => ref.current?.focus());
        onAdded();
      } else {
        toast(r.error ?? 'Fehler', 'danger');
      }
    });
  };

  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-[10px] border border-dashed border-white/[0.12] px-3 py-2.5">
      <span aria-hidden className="shrink-0 text-[14px]" style={{ color: ACCENT }}>+</span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Schritt hinzufügen …"
        disabled={pending}
        className="min-w-0 flex-1 bg-transparent text-[14px] text-[#FAFAFA] outline-none placeholder:text-[#52525B] disabled:opacity-60"
      />
    </div>
  );
}

function InlineEdit({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(v);
        } else if (e.key === 'Escape') {
          onCancel();
        }
      }}
      className="min-w-0 flex-1 rounded border border-[#2A2A30] bg-[#0A0A0C] px-2 py-1 text-[14px] text-[#FAFAFA] outline-none"
    />
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" fill={checked ? 'currentColor' : 'none'} fillOpacity={checked ? 0.05 : 0} />
      {checked && <polyline points="9 12 11 14 15 9" />}
    </svg>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-6 w-6 place-items-center rounded text-[13px] transition-colors disabled:opacity-30 ${
        danger ? 'text-[#52525B] hover:text-[#ff8a8a]' : 'text-[#52525B] hover:text-[#FAFAFA]'
      }`}
    >
      {children}
    </button>
  );
}
