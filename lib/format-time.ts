export function dayBucket(iso: string, now = Date.now()): 'today' | 'yesterday' | string {
  const t = new Date(iso);
  const today = new Date(now);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startYesterday = new Date(startToday.getTime() - 86_400_000);
  if (t >= startToday) return 'today';
  if (t >= startYesterday) return 'yesterday';
  return t.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'short' });
}

export function bucketLabel(bucket: string): string {
  if (bucket === 'today') return 'Heute';
  if (bucket === 'yesterday') return 'Gestern';
  return bucket;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
