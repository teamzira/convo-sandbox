/**
 * Local stand-in for the policy engine's matching run.
 *
 * Produces the same result shape Teambridge returns for a Matching policy —
 * a PASS / FAIL / SKIP verdict per subpolicy with a human-readable message,
 * plus a `passPercentage` to rank on — so the console can be built against
 * fixtures and then switched to the real engine without touching the UI.
 *
 * Assumption worth confirming against the server: `passPercentage` here is
 * passed ÷ evaluated subpolicies, with skipped (inactive) subpolicies out of
 * the denominator.
 */
import type {
  Credential,
  Interpreter,
  MatchResult,
  Shift,
  SubPolicy,
  SubPolicyResult,
} from './types';
import { COVERAGE_POLICY } from './policy';

/** NIC-Advanced subsumes NIC; specialty certifications never substitute. */
const CREDENTIAL_IMPLICATIONS: Partial<Record<Credential, Credential[]>> = {
  'NIC-Advanced': ['NIC'],
};

const MIN_REST_HOURS = 10;
const MAX_CONSECUTIVE_DAYS = 6;
const SENIORITY_YEARS = 5;
const RELIABILITY_FLOOR = 0.9;

function holdsCredential(interpreter: Interpreter, required: Credential): boolean {
  return interpreter.credentials.some(
    (held) => held === required || (CREDENTIAL_IMPLICATIONS[held] ?? []).includes(required),
  );
}

export function shiftHours(shift: Shift): number {
  return (new Date(shift.endAt).getTime() - new Date(shift.startAt).getTime()) / 3_600_000;
}

export function hoursUntil(iso: string, now: Date): number {
  return (new Date(iso).getTime() - now.getTime()) / 3_600_000;
}

/** Base hourly cost before any overtime multiplier. */
export function baseRate(interpreter: Interpreter): number {
  let rate = interpreter.employmentStatus === 'per-diem' ? 58 : 46;
  if (interpreter.credentials.includes('NIC-Advanced')) rate += 6;
  if (interpreter.credentials.includes('CDI')) rate += 5;
  if (
    interpreter.credentials.includes('Legal-Certified') ||
    interpreter.credentials.includes('Medical-Certified')
  ) {
    rate += 4;
  }
  if (interpreter.credentials.includes('Trilingual')) rate += 4;
  return rate;
}

export function tenureYears(interpreter: Interpreter, now: Date): number {
  return (now.getTime() - new Date(interpreter.hireDate).getTime()) / (365.25 * 24 * 3_600_000);
}

function coversShift(interpreter: Interpreter, shift: Shift): boolean {
  const start = new Date(shift.startAt);
  const end = new Date(shift.endAt);
  const startMinute = start.getHours() * 60 + start.getMinutes();
  const endMinute =
    end.getDate() === start.getDate() ? end.getHours() * 60 + end.getMinutes() : 24 * 60;
  return interpreter.availability.some(
    (w) => w.dayOfWeek === start.getDay() && w.startMinute <= startMinute && w.endMinute >= endMinute,
  );
}

function restHours(interpreter: Interpreter, shift: Shift): number | null {
  if (!interpreter.lastShiftEndAt) return null;
  return (
    (new Date(shift.startAt).getTime() - new Date(interpreter.lastShiftEndAt).getTime()) / 3_600_000
  );
}

export type MatchOptions = {
  /** Subpolicies switched off for this run, e.g. to widen a pool that came back empty. */
  disabledSubpolicies?: string[];
};

type Verdict = { pass: boolean; message: string };

/**
 * One evaluator per subpolicy id, keyed to match `policy.ts`. Adding a
 * subpolicy in Policy Builder means adding its mirror in both places.
 */
function evaluateSubpolicy(
  subpolicy: SubPolicy,
  interpreter: Interpreter,
  shift: Shift,
  now: Date,
): Verdict {
  switch (subpolicy.id) {
    case 'credentials': {
      const missing = shift.requiredCredentials.filter((c) => !holdsCredential(interpreter, c));
      return {
        pass: missing.length === 0,
        message: missing.length
          ? `Shift requires ${missing.join(', ')}`
          : `Holds ${shift.requiredCredentials.join(', ')}`,
      };
    }
    case 'jurisdiction': {
      const authorized = interpreter.jurisdictions.includes(shift.jurisdiction);
      return {
        pass: authorized,
        message: authorized
          ? `Cleared for ${shift.jurisdiction}`
          : `Not licensed in ${shift.jurisdiction} — cleared for ${interpreter.jurisdictions.join(', ')}`,
      };
    }
    case 'availability': {
      const available = coversShift(interpreter, shift);
      return {
        pass: available,
        message: available
          ? 'Shift falls inside a published availability window'
          : 'No published availability window covers this shift',
      };
    }
    case 'rest-period': {
      const rest = restHours(interpreter, shift);
      const rested = rest === null || rest >= MIN_REST_HOURS;
      return {
        pass: rested,
        message:
          rest === null
            ? 'No prior shift on record'
            : `${rest.toFixed(1)}h since last shift (${MIN_REST_HOURS}h required)`,
      };
    }
    case 'consecutive-days': {
      const withinLimit = interpreter.consecutiveDaysWorked < MAX_CONSECUTIVE_DAYS;
      return {
        pass: withinLimit,
        message: `${interpreter.consecutiveDaysWorked} consecutive days worked (limit ${MAX_CONSECUTIVE_DAYS})`,
      };
    }
    case 'weekly-max': {
      const projected = interpreter.scheduledWeeklyHours + shiftHours(shift);
      return {
        pass: projected <= interpreter.maxWeeklyHours,
        message: `${projected.toFixed(0)}h projected of ${interpreter.maxWeeklyHours}h max`,
      };
    }
    case 'minimum-hours': {
      const gap = interpreter.committedWeeklyHours - interpreter.scheduledWeeklyHours;
      return {
        pass: gap > 0,
        message:
          gap > 0
            ? `${gap.toFixed(0)}h under a ${interpreter.committedWeeklyHours}h guarantee — already paid for`
            : interpreter.committedWeeklyHours === 0
              ? 'No weekly guarantee to fill'
              : `At or over their ${interpreter.committedWeeklyHours}h guarantee`,
      };
    }
    case 'prior-interest': {
      const sameDay = hoursUntil(shift.startAt, now) <= 24;
      const matched = interpreter.interests.filter(
        (i) =>
          i === shift.queue ||
          i === shift.serviceLine ||
          shift.queue.includes(i) ||
          (sameDay && i === 'Same-day'),
      );
      return {
        pass: matched.length > 0,
        message: matched.length
          ? `Opted into ${matched.join(', ')}`
          : 'Has not opted into this queue or specialty',
      };
    }
    case 'overtime': {
      const projected = interpreter.scheduledWeeklyHours + shiftHours(shift);
      const overtime = Math.max(0, projected - interpreter.overtimeThresholdHours);
      return {
        pass: overtime === 0,
        message:
          overtime === 0
            ? 'Stays within straight time'
            : `${overtime.toFixed(1)}h past the ${interpreter.overtimeThresholdHours}h threshold — billed at 1.5×`,
      };
    }
    case 'seniority': {
      const years = tenureYears(interpreter, now);
      return {
        pass: years >= SENIORITY_YEARS,
        message: `${years.toFixed(0)} years tenure — hired ${new Date(interpreter.hireDate).getFullYear()}`,
      };
    }
    case 'reliability': {
      return {
        pass: interpreter.reliability >= RELIABILITY_FLOOR,
        message: `${Math.round(interpreter.reliability * 100)}% accept & attend over the last 90 days`,
      };
    }
    default:
      return { pass: true, message: 'Not evaluated in the sandbox' };
  }
}

export function evaluateMatch(
  interpreter: Interpreter,
  shift: Shift,
  now: Date,
  options: MatchOptions = {},
): MatchResult {
  const disabled = new Set(options.disabledSubpolicies ?? []);

  const results: SubPolicyResult[] = COVERAGE_POLICY.subpolicies.map((subpolicy) => {
    const skipped = !subpolicy.active || disabled.has(subpolicy.id);
    if (skipped) {
      return {
        subpolicyId: subpolicy.id,
        name: subpolicy.name,
        flag: subpolicy.flag,
        severity: subpolicy.severity,
        state: 'SKIP',
        message: 'Subpolicy is switched off',
      };
    }
    const verdict = evaluateSubpolicy(subpolicy, interpreter, shift, now);
    return {
      subpolicyId: subpolicy.id,
      name: subpolicy.name,
      flag: subpolicy.flag,
      severity: subpolicy.severity,
      state: verdict.pass ? 'PASS' : 'FAIL',
      message: verdict.message,
    };
  });

  const evaluated = results.filter((r) => r.state !== 'SKIP');
  const passed = evaluated.filter((r) => r.state === 'PASS');
  const hours = shiftHours(shift);
  const projectedWeeklyHours = interpreter.scheduledWeeklyHours + hours;
  const overtimeHours = Math.max(0, projectedWeeklyHours - interpreter.overtimeThresholdHours);
  const rate = baseRate(interpreter);
  const overtimeInShift = Math.min(hours, overtimeHours);
  const blendedCost = (hours - overtimeInShift) * rate + overtimeInShift * rate * 1.5;

  return {
    interpreter,
    results,
    passPercentage: evaluated.length === 0 ? 0 : passed.length / evaluated.length,
    blocked: results.some((r) => r.flag === 'BLOCK' && r.state === 'FAIL'),
    projectedWeeklyHours,
    costPerHour: hours > 0 ? blendedCost / hours : rate,
    overtimeHours,
  };
}

export function rankMatches(
  shift: Shift,
  interpreters: Interpreter[],
  now: Date,
  options: MatchOptions = {},
): MatchResult[] {
  return interpreters
    // The interpreter who called out is never offered their own shift back.
    .filter((i) => i.id !== shift.previousInterpreterId)
    .map((i) => evaluateMatch(i, shift, now, options))
    .sort((a, b) => {
      if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
      if (b.passPercentage !== a.passPercentage) return b.passPercentage - a.passPercentage;
      // The engine returns ties; seniority is the contract's stated tiebreak.
      return tenureYears(b.interpreter, now) - tenureYears(a.interpreter, now);
    });
}

export function failedBlockers(match: MatchResult): SubPolicyResult[] {
  return match.results.filter((r) => r.flag === 'BLOCK' && r.state === 'FAIL');
}

/** WARN results, failures first — the signals that decided where a cleared candidate ranked. */
export function warnSignals(match: MatchResult): SubPolicyResult[] {
  return match.results
    .filter((r) => r.flag === 'WARN' && r.state !== 'SKIP')
    .sort((a, b) => (a.state === b.state ? 0 : a.state === 'FAIL' ? 1 : -1));
}
