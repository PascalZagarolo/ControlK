export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        {label}
      </span>
      <span className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}
