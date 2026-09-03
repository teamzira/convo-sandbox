/**
 * Domain model for the Convo coverage sandbox.
 *
 * These types describe what the app renders. They are deliberately independent
 * of how the data arrives: today `lib/sandbox/data.ts` builds them from
 * fixtures, later the same functions will build them from Teambridge
 * Collections records (see `data.ts` for the mapping notes).
 */

export type EmploymentStatus = 'full-time' | 'part-time' | 'per-diem';

export type Credential =
  | 'NIC'
  | 'NIC-Advanced'
  | 'CDI'
  | 'Trilingual'
  | 'Legal-Certified'
  | 'Medical-Certified';

export type ServiceLine = 'VRS' | 'VRI' | 'Community' | 'Legal' | 'Medical';

/** Declared availability, in local time, as minutes from midnight. */
export type AvailabilityWindow = {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type Interpreter = {
  id: string;
  name: string;
  employmentStatus: EmploymentStatus;
  /** Drives seniority tiebreaks. */
  hireDate: string;
  homeRegion: string;
  /** States / provinces this interpreter is licensed or authorized to work in. */
  jurisdictions: string[];
  credentials: Credential[];
  serviceLines: ServiceLine[];
  languages: string[];
  /** Contractual floor. Interpreters below it get priority on open shifts. */
  committedWeeklyHours: number;
  scheduledWeeklyHours: number;
  /** Hours past this trigger overtime. */
  overtimeThresholdHours: number;
  maxWeeklyHours: number;
  availability: AvailabilityWindow[];
  /** Queues / service lines the interpreter has opted into for extra work. */
  interests: string[];
  /** Historical accept-and-attend rate, 0–1. */
  reliability: number;
  /** End of their most recent scheduled shift — feeds the rest-period rule. */
  lastShiftEndAt: string | null;
  consecutiveDaysWorked: number;
};

export type ShiftOrigin = 'callout' | 'unfilled' | 'demand-spike';

export type OfferState = 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export type Offer = {
  interpreterId: string;
  state: OfferState;
  at: string;
};

export type ShiftStatus = 'open' | 'offers-out' | 'filled';

export type Shift = {
  id: string;
  code: string;
  startAt: string;
  endAt: string;
  serviceLine: ServiceLine;
  queue: string;
  /** State or province whose labor rules govern the shift. */
  jurisdiction: string;
  site: string;
  requiredCredentials: Credential[];
  requiredLanguages: string[];
  origin: ShiftOrigin;
  /** Reason only — timing comes from `openedAt`. */
  calloutReason: string | null;
  previousInterpreterId: string | null;
  /** Forecast billable interpreting minutes — the numerator of AMR. */
  billableMinutesForecast: number;
  status: ShiftStatus;
  assignedInterpreterId: string | null;
  offers: Offer[];
  openedAt: string;
};

/**
 * Policy model — mirrors Teambridge's Policy Builder.
 *
 * A Matching policy binds a primary collection (Shifts) to a secondary one
 * (Users) and holds a list of subpolicies. Each subpolicy is one rule,
 * flagged BLOCK (hard exclusion) or WARN (soft signal), authored as a prompt
 * that generates Python evaluated server-side.
 */
export type PolicyFlag = 'BLOCK' | 'WARN';

export type Severity = 'OPTIMIZE' | 'FLAG' | 'AVOID' | 'CRITICAL' | 'BLOCK';

export type SubPolicy = {
  id: string;
  name: string;
  description: string;
  flag: PolicyFlag;
  severity: Severity;
  /** The natural-language prompt Policy Builder turns into the rule's Python. */
  prompt: string;
  /** Where the requirement comes from — what is negotiable vs. legally fixed. */
  source: 'Labor law' | 'Union / contract' | 'Convo policy' | 'Client requirement';
  active: boolean;
};

export type MatchingPolicy = {
  id: string;
  name: string;
  description: string;
  primaryCollection: string;
  secondaryCollection: string;
  subpolicies: SubPolicy[];
};

export type PolicyResultState = 'PASS' | 'FAIL' | 'SKIP';

/** One subpolicy's verdict on one candidate — the unit of explanation. */
export type SubPolicyResult = {
  subpolicyId: string;
  name: string;
  flag: PolicyFlag;
  severity: Severity;
  state: PolicyResultState;
  message: string;
};

export type MatchResult = {
  interpreter: Interpreter;
  results: SubPolicyResult[];
  /** Share of evaluated subpolicies passed — the engine's ranking value. */
  passPercentage: number;
  /** True when a BLOCK subpolicy failed. */
  blocked: boolean;
  /** Projected weekly hours if this interpreter takes the shift. */
  projectedWeeklyHours: number;
  costPerHour: number;
  overtimeHours: number;
};

export type CoverageMetrics = {
  /** Active Minute Rate — billable interpreting minutes ÷ paid minutes. */
  amrActual: number;
  amrTarget: number;
  amrTrend: { week: string; amr: number; target: number }[];
  openShiftCount: number;
  sameDayOpenCount: number;
  calloutsThisWeek: number;
  calloutsAutoCovered: number;
  /** Median hours between a shift opening and it being filled. */
  medianFillHours: number;
  /** Hours scheduled above forecast demand, i.e. the overstaffing cushion. */
  cushionHours: number;
  cushionCostUsd: number;
  scheduledVsDemand: { day: string; scheduled: number; demand: number }[];
};
