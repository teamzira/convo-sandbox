/**
 * Demo seed data for a real Teambridge account.
 *
 * Builds the same world the fixtures describe — a roster of interpreters and
 * a few weeks of shifts with callouts, gaps and covered work — as rows keyed
 * by *field name*. The API route resolves those names to field UUIDs against
 * the account's actual schema before writing.
 *
 * Two hard constraints from the Open API shape the design:
 *
 *   1. Records can be created, not collections or fields. The target
 *      collections must already exist in the account; this only fills them.
 *   2. There is no delete. Anything written here has to be removed by hand in
 *      Teambridge, so every row carries the SEED_MARKER in a text field where
 *      one is available, and the UI says so before you commit.
 */
import { buildInterpreters } from './fixtures';
import type { Interpreter } from './types';

/** Stamped into seeded rows so they can be found and cleaned up later. */
export const SEED_MARKER = '[SANDBOX]';

export type SeedFieldSpec = {
  /** Field name to match in the collection, case-insensitively. */
  name: string;
  /** When true, the collection cannot be seeded without this field. */
  required: boolean;
  /** What this field carries, shown in the preflight. */
  note?: string;
};

export type SeedTarget = {
  key: string;
  /** Collection name, matched exactly and case-insensitively. */
  collection: string;
  label: string;
  description: string;
  fields: SeedFieldSpec[];
  /** Rows keyed by field name; unmatched optional fields are dropped. */
  rows: () => Record<string, unknown>[];
  /**
   * Set when creating these records may have side effects beyond the
   * collection — the UI defaults them off and warns.
   */
  caution?: string;
};

const QUEUES = [
  { queue: 'VRS Morning', service: 'VRS', start: 7, hours: 6, jurisdiction: 'TX', site: 'Remote — Austin queue' },
  { queue: 'VRS Midday', service: 'VRS', start: 11, hours: 6, jurisdiction: 'CA', site: 'Remote — San Diego' },
  { queue: 'VRS Evening', service: 'VRS', start: 16, hours: 6, jurisdiction: 'TX', site: 'Remote — Austin queue' },
  { queue: 'VRS Morning — Canada', service: 'VRS', start: 9, hours: 6, jurisdiction: 'ON', site: 'Remote — Toronto queue' },
  { queue: 'Medical VRI', service: 'Medical', start: 9, hours: 5, jurisdiction: 'CO', site: 'Remote — Denver' },
  { queue: 'VRS Evening', service: 'VRS', start: 17, hours: 5, jurisdiction: 'IL', site: 'Remote — Chicago queue' },
] as const;

const CALLOUT_REASONS = ['Illness', 'Family emergency', 'Schedule conflict', 'Transport failure'];

function iso(now: Date, dayOffset: number, hour: number): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/**
 * Three weeks of shifts: a fortnight ahead plus the past week, so the account
 * has both open coverage to work and filled history to look back on.
 */
function seedShiftRows(now: Date): Record<string, unknown>[] {
  const interpreters = buildInterpreters(now);
  const rows: Record<string, unknown>[] = [];
  let sequence = 5000;

  for (let day = -7; day <= 14; day += 1) {
    for (const [index, block] of QUEUES.entries()) {
      // Thin the weekend down — Convo runs a reduced queue Saturday and Sunday.
      const weekday = new Date(iso(now, day, 12)).getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      if (isWeekend && index % 2 === 1) continue;

      sequence += 1;
      const past = day < 0;
      // Roughly one shift in six is left open; the rest are covered.
      const openSlot = !past && (sequence + day) % 6 === 0;
      const calloutSlot = !past && (sequence + day) % 11 === 0;
      const assignee = interpreters[(sequence + index) % interpreters.length];

      const row: Record<string, unknown> = {
        'Start Time': iso(now, day, block.start),
        'End Time': iso(now, day, block.start + block.hours),
        Published: true,
        Queue: `${SEED_MARKER} ${block.queue}`,
        'Service Line': block.service,
        Jurisdiction: block.jurisdiction,
        Site: block.site,
        Notes: `${SEED_MARKER} seeded demo shift`,
      };

      if (openSlot || calloutSlot) {
        row.Status = calloutSlot ? 'Callout' : 'Open';
        row['Callout Reason'] = calloutSlot
          ? CALLOUT_REASONS[sequence % CALLOUT_REASONS.length]
          : null;
      } else {
        row.Status = past ? 'Completed' : 'Covered';
        row.Assignee = assignee.name;
      }

      rows.push(row);
    }
  }

  return rows;
}

function interpreterRow(interpreter: Interpreter): Record<string, unknown> {
  const [first, ...rest] = interpreter.name.split(' ');
  const handle = interpreter.name.toLowerCase().replace(/[^a-z]+/g, '.');
  return {
    'First Name': first,
    'Last Name': rest.join(' '),
    Email: `${handle}@sandbox.convo.test`,
    'Employment Status': interpreter.employmentStatus,
    'Home Region': interpreter.homeRegion,
    Jurisdictions: interpreter.jurisdictions.join(', '),
    Credentials: interpreter.credentials.join(', '),
    Languages: interpreter.languages.join(', '),
    'Committed Weekly Hours': interpreter.committedWeeklyHours,
    'Max Weekly Hours': interpreter.maxWeeklyHours,
    'Hire Date': interpreter.hireDate,
    Notes: `${SEED_MARKER} seeded demo interpreter`,
  };
}

export function seedTargets(now: Date): SeedTarget[] {
  return [
    {
      key: 'shifts',
      collection: 'Shifts',
      label: 'Shifts',
      description:
        'Three weeks of queue coverage — a week of completed history plus a fortnight ahead, with open gaps and callouts to work.',
      fields: [
        { name: 'Start Time', required: true },
        { name: 'End Time', required: true },
        { name: 'Published', required: false },
        { name: 'Assignee', required: false, note: 'Written as a name; reference fields need a record id' },
        { name: 'Queue', required: false },
        { name: 'Service Line', required: false },
        { name: 'Jurisdiction', required: false },
        { name: 'Site', required: false },
        { name: 'Status', required: false },
        { name: 'Callout Reason', required: false },
        { name: 'Notes', required: false, note: 'Carries the [SANDBOX] marker' },
      ],
      rows: () => seedShiftRows(now),
    },
    {
      key: 'interpreters',
      collection: 'Users',
      label: 'Interpreters',
      description:
        'The twelve-interpreter roster the matching policy ranks — credentials, jurisdictions, commitments and availability.',
      caution:
        'Creating records in Users may provision real people in the account and can trigger invitations. Leave this off unless you have checked what your account does on user creation.',
      fields: [
        { name: 'First Name', required: true },
        { name: 'Last Name', required: true },
        { name: 'Email', required: false },
        { name: 'Employment Status', required: false },
        { name: 'Home Region', required: false },
        { name: 'Jurisdictions', required: false },
        { name: 'Credentials', required: false },
        { name: 'Languages', required: false },
        { name: 'Committed Weekly Hours', required: false },
        { name: 'Max Weekly Hours', required: false },
        { name: 'Hire Date', required: false },
        { name: 'Notes', required: false, note: 'Carries the [SANDBOX] marker' },
      ],
      rows: () => buildInterpreters(now).map(interpreterRow),
    },
  ];
}
