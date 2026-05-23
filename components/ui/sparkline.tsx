'use client';

export function Sparkline({
  values,
  color = '#5eb6ff',
  width = 60,
  height = 16,
  title,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  title?: string;
}) {
  if (values.length === 0) return null;
  const max = Math.max(1, ...values);
  const barW = width / values.length;
  const gap = Math.min(1.5, barW * 0.18);
  const innerW = barW - gap;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {values.map((v, i) => {
        const h = Math.max(1, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * barW + gap / 2}
            y={height - h}
            width={innerW}
            height={h}
            rx={1}
            fill={v > 0 ? color : `${color}30`}
          />
        );
      })}
    </svg>
  );
}
