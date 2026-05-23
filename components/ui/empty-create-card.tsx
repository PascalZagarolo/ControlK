'use client';

export function EmptyCreateCard({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col items-center gap-3 rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] px-6 py-12 text-center transition-colors duration-200 hover:border-white/[0.25] hover:bg-white/[0.04]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-[24px] font-light leading-none text-ink-200 transition-colors group-hover:border-white/[0.20] group-hover:bg-white/[0.08] group-hover:text-ink-50">
        +
      </span>
      <div>
        <div className="text-[15px] font-medium leading-tight text-ink-50">{title}</div>
        <div className="mt-1 text-[12.5px] leading-[1.5] text-ink-300">{subtitle}</div>
      </div>
    </button>
  );
}
