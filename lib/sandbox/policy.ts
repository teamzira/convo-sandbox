/**
 * "Open shift → eligible interpreter" — the Matching policy this app reads.
 *
 * This is a local mirror of a policy authored in Teambridge's Policy Builder,
 * not a second rules engine. Each subpolicy below corresponds to one
 * subpolicy in the real policy: same name, same BLOCK/WARN flag, same
 * severity, and the `prompt` is the natural-language line Policy Builder
 * turns into the evaluated Python.
 *
 * Against a live account the ranking comes back from the engine
 * (`matching_policies/widget_matching`), already ordered, with a
 * `passPercentage` and a PASS/FAIL/ERROR result per subpolicy. The sandbox
 * reproduces that shape locally so the console can be built and reviewed
 * before the policy is wired up.
 */
import type { MatchingPolicy } from './types';

export const COVERAGE_POLICY: MatchingPolicy = {
  id: 'policy-open-shift-coverage',
  name: 'Open shift coverage',
  description:
    'Ranks interpreters against an open shift. BLOCK subpolicies exclude outright; WARN subpolicies determine where a cleared interpreter ranks.',
  primaryCollection: 'Shifts',
  secondaryCollection: 'Users',
  subpolicies: [
    {
      id: 'credentials',
      name: 'Holds required certification',
      description:
        'Interpreter holds every certification the shift requires. NIC-Advanced satisfies an NIC requirement; specialty certifications do not substitute for one another.',
      flag: 'BLOCK',
      severity: 'BLOCK',
      prompt:
        "Block interpreters who don't hold every certification listed on the shift. Treat NIC-Advanced as satisfying NIC.",
      source: 'Client requirement',
      active: true,
    },
    {
      id: 'jurisdiction',
      name: 'Authorized in jurisdiction',
      description:
        'Interpreter is licensed to work in the state or province governing the shift, across every US state and Canadian province Convo operates in.',
      flag: 'BLOCK',
      severity: 'BLOCK',
      prompt:
        "Block interpreters who aren't authorized to work in the shift's state or province.",
      source: 'Labor law',
      active: true,
    },
    {
      id: 'availability',
      name: 'Within declared availability',
      description:
        'The full shift falls inside an availability window the interpreter published for that day of week.',
      flag: 'BLOCK',
      severity: 'BLOCK',
      prompt:
        'Block interpreters whose published availability for that weekday does not cover the whole shift.',
      source: 'Union / contract',
      active: true,
    },
    {
      id: 'rest-period',
      name: 'Minimum rest period observed',
      description:
        'At least 10 hours between the end of the previous shift and the start of this one.',
      flag: 'BLOCK',
      severity: 'BLOCK',
      prompt:
        'Block interpreters with less than 10 hours between their last shift ending and this shift starting.',
      source: 'Labor law',
      active: true,
    },
    {
      id: 'consecutive-days',
      name: 'Under consecutive-day limit',
      description: 'No interpreter is offered a 7th consecutive working day.',
      flag: 'BLOCK',
      severity: 'BLOCK',
      prompt: 'Block interpreters who have already worked 6 consecutive days.',
      source: 'Labor law',
      active: true,
    },
    {
      id: 'weekly-max',
      name: 'Under weekly hour ceiling',
      description:
        'Taking the shift must not push the interpreter past their maximum weekly hours.',
      flag: 'BLOCK',
      severity: 'BLOCK',
      prompt:
        "Block interpreters whose scheduled hours plus this shift would exceed their weekly maximum.",
      source: 'Union / contract',
      active: true,
    },
    {
      id: 'minimum-hours',
      name: 'Guaranteed hours to fill',
      description:
        'Interpreters under their contracted weekly guarantee rank first — Convo pays for those hours whether or not they are worked.',
      flag: 'WARN',
      severity: 'OPTIMIZE',
      prompt:
        'Prefer interpreters whose scheduled hours are below their contracted weekly minimum.',
      source: 'Union / contract',
      active: true,
    },
    {
      id: 'prior-interest',
      name: 'Expressed interest in this work',
      description:
        'Interpreter opted into this queue, this specialty, or same-day work.',
      flag: 'WARN',
      severity: 'OPTIMIZE',
      prompt:
        "Prefer interpreters who opted into the shift's queue or specialty, or into same-day work when the shift starts within 24 hours.",
      source: 'Convo policy',
      active: true,
    },
    {
      id: 'overtime',
      name: 'No overtime incurred',
      description:
        'Flags offers that cross the overtime threshold. They stay available when coverage is at risk, but rank below equivalent straight-time options.',
      flag: 'WARN',
      severity: 'AVOID',
      prompt:
        'Flag interpreters for whom this shift would cross their overtime threshold.',
      source: 'Labor law',
      active: true,
    },
    {
      id: 'seniority',
      name: 'Five or more years tenure',
      description:
        'Long-tenured interpreters are preferred where the contract gives them first refusal on additional hours.',
      flag: 'WARN',
      severity: 'FLAG',
      prompt: 'Prefer interpreters hired more than five years ago.',
      source: 'Union / contract',
      active: true,
    },
    {
      id: 'reliability',
      name: 'Reliable acceptance & attendance',
      description:
        'Interpreters who accept and show up at least 90% of the time, so the first blast is the one that fills.',
      flag: 'WARN',
      severity: 'FLAG',
      prompt:
        'Flag interpreters whose accept-and-attend rate over the last 90 days is below 90%.',
      source: 'Convo policy',
      active: true,
    },
  ],
};

export function activeSubpolicies() {
  return COVERAGE_POLICY.subpolicies.filter((s) => s.active);
}
