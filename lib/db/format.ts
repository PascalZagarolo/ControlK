export function formatCents(cents: number | null | undefined): string {
  if (!cents) return '€ 0';
  const euros = cents / 100;
  return `€ ${euros.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function formatRelativeTo(date: Date | string | null, now = Date.now()): string {
  if (!date) return '—';
  const t = (typeof date === 'string' ? new Date(date) : date).getTime();
  const diffSec = Math.round((now - t) / 1000);
  if (diffSec < 60) return 'gerade eben';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `vor ${diffHr} Std`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `vor ${diffDay} Tg`;
  return (typeof date === 'string' ? new Date(date) : date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
  });
}
