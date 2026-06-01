'use client';

/**
 * Flow — LIST view (the default, always-on base; usable without the chart).
 *
 * Numbered sequence: the single active step in the sand/gold accent, done
 * steps muted, waiting steps dimmed ("blockiert / noch nicht dran"). Status
 * colours + labels come from the CENTRAL token map (lib/flows/status), shared
 * with the flow-chart view — never hardcoded per component. Add / remove /
 * reorder / toggle write the same todo model the chart writes.
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
import { FLOW_STATUS } from '@/lib/flows/status';
import type { FlowStep } from '@/lib/flows/sequence';
import type { FlowStepCommitment } from '@/lib/db/queries/flows';

export function FlowListView({
  flowId,
  steps,
  commitments = {},
}: {
  flowId: string;
  steps: FlowStep[];
  commitments?: Record<string, FlowStepCommitment>;
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
        <p className="py-6 text-center text-[13px] italic text-[#6a6b6c]">
          Noch keine Schritte. Füge den ersten unten hinzu.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {steps.map((step, i) => {
              const tok = FLOW_STATUS[step.state];
              const commitment = commitments[step.id];
              return (
                <motion.li
                  layout
                  key={step.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="group flex items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-colors"
                  style={{ borderColor: tok.border, background: tok.bg, opacity: tok.opacity }}
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[11px]"
                    style={{
                      background: `${tok.color}22`,
                      color: tok.color,
                      border: step.state === 'active' ? `1px solid ${tok.color}` : '1px solid transparent',
                    }}
                  >
                    {step.state === 'done' ? '✓' : step.position}
                  </span>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(() => toggleFlowStep(step.id))}
                    aria-label={step.state === 'done' ? 'Wieder öffnen' : 'Erledigt'}
                    className="shrink-0 text-[#6a6b6c] transition-colors hover:text-[#FAFAFA] disabled:opacity-50"
                  >
                    <Box checked={step.state === 'done'} />
                  </button>

                  <div className="min-w-0 flex-1">
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
                        className={`block w-full truncate text-left text-[14px] ${
                          step.state === 'done' ? 'text-[#6a6b6c] line-through decoration-[#6a6b6c]/40' : 'text-[#FAFAFA]'
                        }`}
                      >
                        {step.title}
                      </button>
                    )}
                    {/* Wedge-hook indicator (Schritt ↔ Zusage). */}
                    {commitment && (
                      <span className="mt-0.5 block truncate text-[11px]" style={{ color: '#E8B86D' }}>
                        ↳ {commitment.label}
                      </span>
                    )}
                  </div>

                  {/* Central status label — locked caps. */}
                  <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.4px]" style={{ color: tok.color }}>
                    {tok.label}
                  </span>

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
              );
            })}
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
      <span aria-hidden className="shrink-0 text-[14px] text-[#E8B86D]">+</span>
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
        placeholder="Schritt anhängen …"
        disabled={pending}
        className="min-w-0 flex-1 bg-transparent text-[14px] text-[#FAFAFA] outline-none placeholder:text-[#6a6b6c] disabled:opacity-60"
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
      className="w-full rounded border border-[#2f3031] bg-[#0c0d0f] px-2 py-1 text-[14px] text-[#FAFAFA] outline-none"
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
        danger ? 'text-[#6a6b6c] hover:text-[#ff8a8a]' : 'text-[#6a6b6c] hover:text-[#FAFAFA]'
      }`}
    >
      {children}
    </button>
  );
}
