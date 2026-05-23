'use client';

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium leading-none transition-colors duration-150 ${
              active
                ? 'border-white/15 bg-white/[0.08] text-ink-50'
                : 'border-white/[0.06] bg-white/[0.02] text-ink-200 hover:border-white/10 hover:bg-white/[0.04] hover:text-ink-50'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
