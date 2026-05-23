'use client';

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function ChannelHeatmap({ grid }: { grid: number[][] }) {
  // Reorder so Monday first
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((i) => ({
    label: DOW_LABELS[i],
    counts: grid[i],
  }));
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Channel-Aktivität · 30 Tage
        </span>
        <span className="font-mono text-[10px] text-ink-300">{max} max/h</span>
      </div>
      <div className="flex flex-col gap-[2px]">
        {ordered.map((row) => (
          <div key={row.label} className="flex items-center gap-1.5">
            <span className="w-6 font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
              {row.label}
            </span>
            <div className="flex flex-1 gap-[1.5px]">
              {row.counts.map((c, hour) => {
                const intensity = c / max;
                return (
                  <span
                    key={hour}
                    title={`${row.label} ${hour}-${hour + 1}h: ${c} Nachrichten`}
                    className="h-3.5 flex-1 rounded-[1px]"
                    style={{
                      background:
                        c === 0
                          ? 'rgba(255,255,255,0.04)'
                          : `rgba(94, 182, 255, ${0.15 + intensity * 0.85})`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.3px] text-ink-300">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}
