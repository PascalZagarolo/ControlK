type Tone = 'green' | 'blue' | 'red' | 'yellow' | 'neutral' | 'purple';

const TONES: Record<Tone, { bg: string; fg: string; dot: string }> = {
  green: { bg: 'bg-[#5ee08a]/10', fg: 'text-[#5ee08a]', dot: 'bg-[#5ee08a]' },
  blue: { bg: 'bg-[#5eb6ff]/10', fg: 'text-[#5eb6ff]', dot: 'bg-[#5eb6ff]' },
  red: { bg: 'bg-[#ff8a8a]/10', fg: 'text-[#ff8a8a]', dot: 'bg-[#ff8a8a]' },
  yellow: { bg: 'bg-[#ffd96a]/10', fg: 'text-[#ffd96a]', dot: 'bg-[#ffd96a]' },
  neutral: { bg: 'bg-white/[0.04]', fg: 'text-ink-200', dot: 'bg-ink-200' },
  purple: { bg: 'bg-[#c084fc]/10', fg: 'text-[#c084fc]', dot: 'bg-[#c084fc]' },
};

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${t.bg} ${t.fg}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}
