export function Panel({
  label,
  trailing,
  children,
  className,
}: {
  label?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[14px] border border-white/[0.08] bg-[rgba(14,15,18,0.85)] p-4 shadow-panel backdrop-blur-xl backdrop-saturate-150 ${
        className ?? ''
      }`}
    >
      {(label || trailing) && (
        <div className="mb-3 flex items-center justify-between">
          {label && (
            <div className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              {label}
            </div>
          )}
          {trailing}
        </div>
      )}
      {children}
    </section>
  );
}
