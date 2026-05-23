export function AuthShell({
  kicker,
  title,
  subtitle,
  children,
  footer,
}: {
  kicker: string;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6 pt-24">
      <div className="w-[min(440px,calc(100vw-32px))] rounded-[14px] border border-white/[0.08] bg-[rgba(14,15,18,0.85)] p-7 shadow-panel backdrop-blur-xl">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          {kicker}
        </span>
        <h1 className="mt-3 text-[24px] font-medium leading-tight tracking-[-0.3px] text-ink-50">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-200">{subtitle}</p>
        )}
        <div className="mt-6">{children}</div>
        {footer && (
          <div className="mt-6 border-t border-white/[0.06] pt-4 text-[12.5px] leading-[1.55] text-ink-300">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="block w-full rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[14px] text-ink-50 outline-none transition-colors placeholder:text-ink-300 focus:border-white/[0.20] focus:bg-white/[0.05]"
    />
  );
}

export function PrimaryButton({
  pending,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || pending}
      className="w-full rounded-[8px] bg-white px-4 py-2.5 text-[13.5px] font-medium leading-none text-black transition-opacity duration-150 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? 'Bitte warten …' : children}
    </button>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-[8px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/10 px-3 py-2 text-[12.5px] leading-[1.5] text-[#ffbdbd]">
      {children}
    </div>
  );
}

export function InfoBanner({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-[8px] border border-[#5eb6ff]/25 bg-[#5eb6ff]/10 px-3 py-2 text-[12.5px] leading-[1.5] text-[#bcd9ff]">
      {children}
    </div>
  );
}
