'use client';

import { useDeferredValue, useMemo } from 'react';
import { checkStrength, type StrengthResult } from '@/lib/auth/strength';

const COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: '#ff8a8a',
  1: '#ffb45e',
  2: '#ffd96a',
  3: '#5eb6ff',
  4: '#5ee08a',
};

export function PasswordStrength({
  password,
  userInputs = [],
}: {
  password: string;
  userInputs?: string[];
}) {
  const def = useDeferredValue(password);
  const result: StrengthResult | null = useMemo(
    () => (def ? checkStrength(def, userInputs) : null),
    [def, userInputs]
  );
  if (!result) return null;

  const segments = [0, 1, 2, 3, 4];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {segments.map((i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-200"
            style={{
              background: i <= result.score ? COLORS[result.score] : 'rgba(255,255,255,0.06)',
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span
          className="font-mono text-[10.5px] uppercase tracking-[0.3px]"
          style={{ color: COLORS[result.score] }}
        >
          {result.label}
        </span>
        {result.warning && (
          <span className="text-[11px] text-ink-300">{result.warning}</span>
        )}
      </div>
    </div>
  );
}
