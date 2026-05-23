export function Avatar({
  initials,
  from,
  to,
  size = 36,
}: {
  initials: string;
  from: string;
  to: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium leading-none text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
        boxShadow:
          '0 1px 0 0 rgba(0,0,0,.2), inset 0 1px 0 0 rgba(255,255,255,.14)',
      }}
    >
      {initials}
    </span>
  );
}
