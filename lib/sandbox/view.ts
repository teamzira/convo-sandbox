/**
 * Server → client view models.
 *
 * Matching runs on the server; the browser receives plain, already-formatted
 * data in the shape the policy engine returns. Keeping it flat here means the
 * client components never import the domain types or the matcher.
 */
import type { MatchResult, Offer, OfferState, PolicyResultState, Shift } from './types';
import { failedBlockers, shiftHours, warnSignals } from './matching';
import { initialsOf } from './format';

export type SignalView = {
  name: string;
  message: string;
  state: PolicyResultState;
};

export type CandidateView = {
  id: string;
  name: string;
  initials: string;
  employmentStatus: string;
  homeRegion: string;
  eligible: boolean;
  /** 0–1, the engine's ranking value. */
  passPercentage: number;
  passedCount: number;
  evaluatedCount: number;
  signals: SignalView[];
  blockers: { name: string; message: string }[];
  scheduledWeeklyHours: number;
  committedWeeklyHours: number;
  projectedWeeklyHours: number;
  overtimeHours: number;
  costPerHour: number;
  shiftCost: number;
  reliability: number;
  offerState: OfferState | null;
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  'per-diem': 'Per diem',
};

export function toCandidateView(match: MatchResult, shift: Shift): CandidateView {
  const { interpreter } = match;
  const offer = shift.offers.find((o: Offer) => o.interpreterId === interpreter.id);
  const hours = shiftHours(shift);
  const evaluated = match.results.filter((r) => r.state !== 'SKIP');

  return {
    id: interpreter.id,
    name: interpreter.name,
    initials: initialsOf(interpreter.name),
    employmentStatus:
      EMPLOYMENT_LABEL[interpreter.employmentStatus] ?? interpreter.employmentStatus,
    homeRegion: interpreter.homeRegion,
    eligible: !match.blocked,
    passPercentage: match.passPercentage,
    passedCount: evaluated.filter((r) => r.state === 'PASS').length,
    evaluatedCount: evaluated.length,
    signals: warnSignals(match).map((r) => ({
      name: r.name,
      message: r.message,
      state: r.state,
    })),
    blockers: failedBlockers(match).map((r) => ({ name: r.name, message: r.message })),
    scheduledWeeklyHours: interpreter.scheduledWeeklyHours,
    committedWeeklyHours: interpreter.committedWeeklyHours,
    projectedWeeklyHours: match.projectedWeeklyHours,
    overtimeHours: match.overtimeHours,
    costPerHour: match.costPerHour,
    shiftCost: match.costPerHour * hours,
    reliability: interpreter.reliability,
    offerState: offer?.state ?? null,
  };
}
