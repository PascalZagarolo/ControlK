// Pure threshold math — no DB, no fetches, easy to unit-test if we
// ever want to. Median + IQR are deliberately chosen over mean + stddev
// because a single 60-day vacation gap would otherwise pull the
// threshold up dramatically and silence the alert that actually matters.

export const DEFAULT_THRESHOLD_DAYS: Record<string, number> = {
  person: 21,
  customer: 14,
  project: 30,
  channel: 9,
  note: 60,
};

const MIN_INTERACTIONS_TO_LEARN = 5;
const MS_PER_DAY = 86_400_000;

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const t = pos - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

export type ThresholdStats = {
  totalInteractions: number;
  firstInteractionAt: Date | null;
  lastInteractionAt: Date | null;
  medianDaysBetween: number | null;
  iqrDaysBetween: number | null;
  alertThresholdDays: number;
  importanceScore: number;
};

/**
 * Computes everything needed for one entity_thresholds row from the
 * raw list of interaction timestamps (ascending). Dates may be the
 * same value across multiple interactions (e.g. two channel messages
 * in the same minute) — we filter those duplicate days when computing
 * intervals so the rhythm doesn't get distorted to ~0.
 */
export function computeThresholdStats(
  entityType: string,
  occurrences: Date[]
): ThresholdStats {
  const sorted = [...occurrences].sort((a, b) => a.getTime() - b.getTime());
  const total = sorted.length;

  if (total === 0) {
    return {
      totalInteractions: 0,
      firstInteractionAt: null,
      lastInteractionAt: null,
      medianDaysBetween: null,
      iqrDaysBetween: null,
      alertThresholdDays:
        DEFAULT_THRESHOLD_DAYS[entityType] ?? DEFAULT_THRESHOLD_DAYS.person,
      importanceScore: 0,
    };
  }

  const first = sorted[0];
  const last = sorted[total - 1];

  // Intervals in days between distinct day-buckets, not raw
  // timestamps — two messages 3 minutes apart shouldn't register as
  // an 0.002-day interval and crush the median.
  const dayBuckets: number[] = [];
  let lastBucket = -1;
  for (const t of sorted) {
    const bucket = Math.floor(t.getTime() / MS_PER_DAY);
    if (bucket !== lastBucket) {
      dayBuckets.push(bucket);
      lastBucket = bucket;
    }
  }
  const intervals: number[] = [];
  for (let i = 1; i < dayBuckets.length; i++) {
    intervals.push(dayBuckets[i] - dayBuckets[i - 1]);
  }

  let medianDays: number | null = null;
  let iqrDays: number | null = null;
  let alertThreshold: number =
    DEFAULT_THRESHOLD_DAYS[entityType] ?? DEFAULT_THRESHOLD_DAYS.person;

  if (intervals.length >= MIN_INTERACTIONS_TO_LEARN - 1) {
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    medianDays = median(sortedIntervals);
    const q1 = quantile(sortedIntervals, 0.25);
    const q3 = quantile(sortedIntervals, 0.75);
    iqrDays = q3 - q1;

    // Threshold = median + 1.5 × IQR (the classical Tukey upper fence).
    // Clamped to a sensible band so a hyper-regular contact (median=2d,
    // IQR=0) still gets an effective threshold of at least 1.5× median,
    // and a sporadic contact never gets an alert later than 3× the
    // entity-type default.
    const upperFence = medianDays + 1.5 * iqrDays;
    const minThreshold = Math.max(1, Math.round(medianDays * 1.5));
    const maxThreshold =
      (DEFAULT_THRESHOLD_DAYS[entityType] ?? DEFAULT_THRESHOLD_DAYS.person) * 3;
    alertThreshold = Math.max(
      minThreshold,
      Math.min(maxThreshold, Math.round(upperFence))
    );
  }

  // Importance: frequency × recency. Frequency = interactions per day
  // since first contact. Recency = exponential decay with 30d half-life.
  const daysSinceFirst = Math.max(
    1,
    (Date.now() - first.getTime()) / MS_PER_DAY
  );
  const daysSinceLast = (Date.now() - last.getTime()) / MS_PER_DAY;
  const frequency = total / daysSinceFirst;
  const recencyBonus = Math.exp(-daysSinceLast / 30);
  const importanceScore = frequency * 100 + recencyBonus * 50;

  return {
    totalInteractions: total,
    firstInteractionAt: first,
    lastInteractionAt: last,
    medianDaysBetween: medianDays,
    iqrDaysBetween: iqrDays,
    alertThresholdDays: alertThreshold,
    importanceScore,
  };
}

/**
 * Severity bucket for the standstill view. "kritisch" if days silent
 * is >2× threshold, "auffällig" if 1-2× threshold, otherwise no
 * standstill.
 */
export type Severity = 'kritisch' | 'auffaellig' | 'normal';

export function severityFor(daysSilent: number, threshold: number): Severity {
  if (daysSilent < threshold) return 'normal';
  if (daysSilent >= threshold * 2) return 'kritisch';
  return 'auffaellig';
}
