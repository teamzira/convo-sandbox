/**
 * Quarter-hour coverage curve.
 *
 * The daily bars on the board are sums of these intervals, not separate
 * numbers — drilling into a day always reconciles with the bar above it.
 *
 * Demand is interpreters needed to answer the queue without callers waiting;
 * scheduled is interpreters actually on. The gap in both directions is what
 * Convo pays for: overstaffed minutes are paid and non-billable, and pull AMR
 * down; understaffed minutes are billable minutes not earned.
 */

/** 15 minutes, in minutes. */
export const INTERVAL_MINUTES = 15;
const INTERVALS_PER_DAY = (24 * 60) / INTERVAL_MINUTES;

export type IntervalPoint = {
  /** Minutes from midnight. */
  minute: number;
  label: string;
  scheduled: number;
  demand: number;
};

export type DayCoverage = {
  key: string;
  label: string;
  /** ISO date for the day this curve describes. */
  date: string;
  weekend: boolean;
  intervals: IntervalPoint[];
  scheduledHours: number;
  demandHours: number;
  /** Interpreter-hours scheduled above demand — paid, non-billable. */
  cushionHours: number;
  /** Interpreter-hours of demand with nobody on — billable minutes not earned. */
  shortfallHours: number;
  peakShortfall: number;
};

/** Deterministic PRNG so the same day always renders the same curve. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Interpreters needed, by hour of day — a VRS queue's shape: overnight floor,
 * a morning ramp, twin business-hours peaks, and an evening tail.
 */
const DEMAND_BY_HOUR = [
  2, 2, 2, 2, 2, 3, 5, 9, 14, 17, 18, 17, 14, 16, 17, 16, 13, 11, 9, 8, 6, 5, 4, 3, 2,
];

function demandAt(minute: number, weekendFactor: number, jitter: number): number {
  const hour = minute / 60;
  const lower = Math.floor(hour);
  const upper = Math.min(lower + 1, 24);
  const blend = hour - lower;
  const interpolated =
    DEMAND_BY_HOUR[lower] * (1 - blend) + DEMAND_BY_HOUR[upper] * blend;
  return Math.max(1, Math.round(interpolated * weekendFactor * (0.94 + jitter * 0.12)));
}

/**
 * Staffing is blocked, not continuous — interpreters are scheduled in two-hour
 * chunks sized off the demand at the start of the block, plus a cushion.
 */
function buildScheduled(
  demand: number[],
  random: () => number,
): number[] {
  const scheduled = new Array<number>(INTERVALS_PER_DAY).fill(0);
  const blockLength = 8; // 8 × 15min = 2h

  for (let start = 0; start < INTERVALS_PER_DAY; start += blockLength) {
    const window = demand.slice(start, start + blockLength);
    const average = window.reduce((sum, v) => sum + v, 0) / window.length;
    // Staffing to the block average rather than its peak is what leaves the
    // queue short at the busy end of a block and over at the quiet end.
    // The multiplier on top is Convo's deliberate cushion, held because
    // last-minute shifts are hard to fill.
    const cushion = average >= 10 ? 1.1 : 1.2;
    let headcount = Math.max(2, Math.round(average * cushion));

    // A couple of blocks a day land short — the windows worth looking at.
    if (random() < 0.14) headcount = Math.max(1, Math.round(average * 0.85));

    for (let i = start; i < Math.min(start + blockLength, INTERVALS_PER_DAY); i += 1) {
      scheduled[i] = headcount;
    }
  }

  return scheduled;
}

function timeLabel(minute: number): string {
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(min).padStart(2, '0')} ${suffix}`;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The Monday-anchored week containing `now`. */
export function buildWeekCoverage(now: Date): DayCoverage[] {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  const offsetToMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offsetToMonday);

  return DAY_LABELS.map((label, dayIndex) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + dayIndex);
    const weekend = dayIndex >= 5;
    const random = mulberry32(date.getFullYear() * 1000 + date.getMonth() * 40 + date.getDate());

    const demand: number[] = [];
    for (let i = 0; i < INTERVALS_PER_DAY; i += 1) {
      demand.push(demandAt(i * INTERVAL_MINUTES, weekend ? 0.58 : 1, random()));
    }
    const scheduled = buildScheduled(demand, random);

    const intervals: IntervalPoint[] = demand.map((value, i) => ({
      minute: i * INTERVAL_MINUTES,
      label: timeLabel(i * INTERVAL_MINUTES),
      demand: value,
      scheduled: scheduled[i],
    }));

    const hoursPerInterval = INTERVAL_MINUTES / 60;
    const scheduledHours = scheduled.reduce((sum, v) => sum + v, 0) * hoursPerInterval;
    const demandHours = demand.reduce((sum, v) => sum + v, 0) * hoursPerInterval;
    const cushionHours =
      intervals.reduce((sum, p) => sum + Math.max(0, p.scheduled - p.demand), 0) *
      hoursPerInterval;
    const shortfallHours =
      intervals.reduce((sum, p) => sum + Math.max(0, p.demand - p.scheduled), 0) *
      hoursPerInterval;
    const peakShortfall = intervals.reduce(
      (worst, p) => Math.max(worst, p.demand - p.scheduled),
      0,
    );

    return {
      key: label,
      label,
      date: date.toISOString(),
      weekend,
      intervals,
      scheduledHours,
      demandHours,
      cushionHours,
      shortfallHours,
      peakShortfall,
    };
  });
}

/** Contiguous runs where demand outran the schedule. */
export function shortfallWindows(day: DayCoverage): {
  start: string;
  end: string;
  peak: number;
  minutes: number;
}[] {
  const windows: { start: string; end: string; peak: number; minutes: number }[] = [];
  let current: { startIndex: number; peak: number } | null = null;

  day.intervals.forEach((point, index) => {
    const gap = point.demand - point.scheduled;
    if (gap > 0) {
      if (current) current.peak = Math.max(current.peak, gap);
      else current = { startIndex: index, peak: gap };
      return;
    }
    if (current) {
      windows.push({
        start: day.intervals[current.startIndex].label,
        end: point.label,
        peak: current.peak,
        minutes: (index - current.startIndex) * INTERVAL_MINUTES,
      });
      current = null;
    }
  });

  if (current !== null) {
    const open = current as { startIndex: number; peak: number };
    windows.push({
      start: day.intervals[open.startIndex].label,
      end: '12:00 AM',
      peak: open.peak,
      minutes: (day.intervals.length - open.startIndex) * INTERVAL_MINUTES,
    });
  }

  return windows;
}
