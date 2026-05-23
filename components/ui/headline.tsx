export function Headline({
  kicker,
  title,
  subtitle,
  meta,
  trailing,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-300">
        {kicker}
      </span>
      <h1 className="text-[36px] font-medium leading-[1.05] tracking-[-0.6px] text-ink-50 md:text-[44px]">
        {title}
      </h1>
      {subtitle && (
        <p className="max-w-[560px] text-[14.5px] leading-[1.55] text-ink-200">{subtitle}</p>
      )}
      {(meta || trailing) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {meta}
          {trailing && <div className="ml-auto">{trailing}</div>}
        </div>
      )}
    </div>
  );
}

export function MetaTag({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <span
      className={`font-mono text-[11px] uppercase tracking-[0.3px] ${
        highlight ? 'text-ink-50' : 'text-ink-300'
      }`}
    >
      {children}
    </span>
  );
}

export function MetaDivider() {
  return <span className="text-ink-300/40">·</span>;
}
