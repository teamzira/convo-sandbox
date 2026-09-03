/**
 * Data access for the sandbox — the single swap point for real data.
 *
 * Every accessor is async and returns domain types, so pointing the app at a
 * live account means reimplementing these bodies against the Unified
 * Collections API and changing nothing else:
 *
 *   Interpreter  ← "Users" collection (+ credential, availability and
 *                  commitment fields), read via getFields() → field-id lookup
 *   Shift        ← "Shifts" collection; `previousInterpreterId` and
 *                  `assignedInterpreterId` are reference fields holding the
 *                  related record id, resolved against Users
 *   Offer        ← "Shift Offers" collection, one record per interpreter per
 *                  blast, referencing both Shift and User
 *   Metrics      ← computed server-side; the browser should receive the
 *                  finished numbers rather than paging records to derive them
 *
 * Reads must be user-scoped: `getTBClient(userContext)` with the context from
 * `getTBContext()`, and paged at 50 records per request.
 */
import { buildInterpreters, buildShifts } from './fixtures';
import { buildWeekCoverage, type DayCoverage } from './intervals';
import type { CoverageMetrics, Interpreter, Shift } from './types';
import { shiftHours } from './matching';

/**
 * Single clock for a render pass. Fixtures are generated relative to it, so
 * every timestamp on a page agrees with every other one.
 */
export function sandboxNow(): Date {
  return new Date();
}

export async function getInterpreters(now: Date = sandboxNow()): Promise<Interpreter[]> {
  return buildInterpreters(now);
}

export async function getShifts(now: Date = sandboxNow()): Promise<Shift[]> {
  return buildShifts(now);
}

export async function getShift(id: string, now: Date = sandboxNow()): Promise<Shift | null> {
  const shifts = await getShifts(now);
  return shifts.find((s) => s.id === id) ?? null;
}

export async function getInterpreter(
  id: string,
  now: Date = sandboxNow(),
): Promise<Interpreter | null> {
  const interpreters = await getInterpreters(now);
  return interpreters.find((i) => i.id === id) ?? null;
}

/** Name lookup for reference fields, mirroring the recordId → name map a real read needs. */
export async function getInterpreterNames(
  now: Date = sandboxNow(),
): Promise<Record<string, string>> {
  const interpreters = await getInterpreters(now);
  return Object.fromEntries(interpreters.map((i) => [i.id, i.name]));
}

function weekLabel(now: Date, weeksAgo: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - weeksAgo * 7);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function getCoverageMetrics(
  now: Date = sandboxNow(),
): Promise<CoverageMetrics> {
  const shifts = await getShifts(now);
  const open = shifts.filter((s) => s.status !== 'filled');
  const sameDay = open.filter(
    (s) => new Date(s.startAt).toDateString() === now.toDateString(),
  );
  const callouts = shifts.filter((s) => s.origin === 'callout');
  const calloutsAutoCovered = callouts.filter((s) => s.status === 'filled').length;

  // Daily totals are sums of the quarter-hour curve, so drilling into a day
  // always reconciles with its bar.
  const week = buildWeekCoverage(now);
  const scheduledVsDemand = week.map((day) => ({
    day: day.label,
    scheduled: Math.round(day.scheduledHours),
    demand: Math.round(day.demandHours),
  }));
  const cushionHours = Math.round(week.reduce((sum, day) => sum + day.cushionHours, 0));

  const amrTrend = [7, 6, 5, 4, 3, 2, 1, 0].map((weeksAgo, index) => ({
    week: weekLabel(now, weeksAgo),
    amr: [0.671, 0.664, 0.679, 0.688, 0.681, 0.694, 0.702, 0.698][index],
    target: 0.75,
  }));

  return {
    amrActual: amrTrend[amrTrend.length - 1].amr,
    amrTarget: 0.75,
    amrTrend,
    openShiftCount: open.length,
    sameDayOpenCount: sameDay.length,
    calloutsThisWeek: callouts.length + 9,
    calloutsAutoCovered: calloutsAutoCovered + 4,
    medianFillHours: 31.5,
    cushionHours,
    cushionCostUsd: cushionHours * 47,
    scheduledVsDemand,
  };
}

/** The quarter-hour curve behind the daily bars, for the day drill-down. */
export async function getWeekCoverage(now: Date = sandboxNow()): Promise<DayCoverage[]> {
  return buildWeekCoverage(now);
}

/** Hours of coverage currently sitting unfilled — the exposure on the board. */
export function openCoverageHours(shifts: Shift[]): number {
  return shifts.filter((s) => s.status !== 'filled').reduce((sum, s) => sum + shiftHours(s), 0);
}
