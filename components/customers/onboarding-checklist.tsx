'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleOnboardingStep } from '@/lib/actions/customers';
import { ONBOARDING_STEPS } from '@/lib/types';

export function OnboardingChecklist({
  customerId,
  progress,
}: {
  customerId: string;
  progress: Record<string, boolean>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const doneCount = ONBOARDING_STEPS.filter((s) => progress[s.key]).length;
  const total = ONBOARDING_STEPS.length;
  const pct = (doneCount / total) * 100;
  const complete = doneCount === total;

  if (complete) return null;

  return (
    <div className="rounded-[12px] border border-[#5eb6ff]/25 bg-[#5eb6ff]/[0.05] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#5eb6ff]">
            Onboarding
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-ink-50">
            {doneCount} / {total} Schritte erledigt
          </p>
        </div>
        <div className="flex w-32 flex-col items-end gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#5eb6ff] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-ink-300">{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {ONBOARDING_STEPS.map((step) => {
          const done = !!progress[step.key];
          return (
            <button
              key={step.key}
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await toggleOnboardingStep({ customerId, stepKey: step.key });
                  router.refresh();
                })
              }
              className="flex items-center gap-2.5 rounded-[6px] px-2 py-1 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                  done
                    ? 'border-[#5ee08a] bg-[#5ee08a]/15'
                    : 'border-white/[0.18] hover:border-white/[0.40]'
                }`}
              >
                {done && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#5ee08a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </span>
              <span className={`text-[12.5px] ${done ? 'text-ink-300 line-through' : 'text-ink-50'}`}>
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
