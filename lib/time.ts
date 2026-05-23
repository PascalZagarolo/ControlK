export function formatRelativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const diffSec = Math.round((now - t) / 1000);
  if (diffSec < 60) return 'gerade eben';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `vor ${diffHr} Std`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `vor ${diffDay} Tg`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}
