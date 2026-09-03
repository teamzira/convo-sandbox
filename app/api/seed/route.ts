/**
 * Seed demo data into the connected Teambridge account.
 *
 * GET  — preflight. Reports what is configured, which target collections
 *        exist, which fields resolved, and how many rows would be written.
 *        Writes nothing.
 * POST — creates the records for the requested targets.
 *
 * The Open API can create records but not collections or fields, and offers
 * no delete. So this route never assumes a schema: it matches collections and
 * fields by name, drops optional fields the account does not have, refuses a
 * target whose required fields are missing, and reports exactly what it wrote.
 */
import { NextResponse } from 'next/server';
import { getCredentialsForAccount, getTBContext, TBClient } from '@/lib/teambridge';
import type { Collection, Field } from '@/lib/teambridge/client/types';
import { SEED_MARKER, seedTargets, type SeedTarget } from '@/lib/sandbox/seed';
import type {
  FieldResolution,
  PreflightResponse,
  SeedResult,
  TargetPreflight,
} from '@/lib/sandbox/seed-contract';

/** How many record creates are in flight at once. */
const WRITE_CONCURRENCY = 4;

function buildClient(userContext: string | undefined) {
  const credentials = getCredentialsForAccount();
  if (!credentials) return null;
  return new TBClient({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    baseUrl: process.env.TB_OPEN_API_BASE_URL,
    authUrl: process.env.TB_AUTH_URL,
    audience: process.env.TB_AUDIENCE,
    userContext,
  });
}

function findCollection(collections: Collection[], name: string): Collection | undefined {
  // Exact, case-insensitive — a partial match would grab "Shifts Group".
  return collections.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

function resolveFields(target: SeedTarget, fields: Field[]): FieldResolution {
  const byName = new Map(fields.map((f) => [f.name.toLowerCase(), f]));
  const matched: { name: string; id: string }[] = [];
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const spec of target.fields) {
    const field = byName.get(spec.name.toLowerCase());
    if (field) matched.push({ name: spec.name, id: field.id });
    else if (spec.required) missingRequired.push(spec.name);
    else missingOptional.push(spec.name);
  }

  return { matched, missingRequired, missingOptional };
}

async function preflight(): Promise<PreflightResponse> {
  const { accountId, userContext } = await getTBContext();
  const client = buildClient(userContext);
  const targets = seedTargets(new Date());

  const base = targets.map<TargetPreflight>((target) => ({
    key: target.key,
    label: target.label,
    collection: target.collection,
    description: target.description,
    caution: target.caution,
    found: false,
    collectionId: null,
    rowCount: target.rows().length,
    fields: null,
    seedable: false,
  }));

  if (!client) {
    return { configured: false, accountId, marker: SEED_MARKER, targets: base };
  }

  try {
    const collections = await client.collections.list();

    const resolved = await Promise.all(
      targets.map(async (target, index) => {
        const collection = findCollection(collections, target.collection);
        if (!collection) return base[index];

        const fields = await client.collections.getFields(collection.id);
        const resolution = resolveFields(target, fields);
        return {
          ...base[index],
          found: true,
          collectionId: collection.id,
          fields: resolution,
          seedable: resolution.missingRequired.length === 0,
        };
      }),
    );

    return { configured: true, accountId, marker: SEED_MARKER, targets: resolved };
  } catch (error) {
    return {
      configured: true,
      accountId,
      marker: SEED_MARKER,
      targets: base,
      error: error instanceof Error ? error.message : 'Failed to read collections',
    };
  }
}

export async function GET() {
  return NextResponse.json(await preflight());
}

export async function POST(request: Request) {
  const { userContext } = await getTBContext();
  const client = buildClient(userContext);

  if (!client) {
    return NextResponse.json(
      { error: 'No Teambridge credentials configured for this account.' },
      { status: 400 },
    );
  }

  let requestedKeys: string[] = [];
  try {
    const body = (await request.json()) as { targets?: unknown };
    if (Array.isArray(body.targets)) {
      requestedKeys = body.targets.filter((key): key is string => typeof key === 'string');
    }
  } catch {
    // An empty body means "nothing selected" — fall through to the guard below.
  }

  if (requestedKeys.length === 0) {
    return NextResponse.json({ error: 'Select at least one thing to seed.' }, { status: 400 });
  }

  const now = new Date();
  const targets = seedTargets(now).filter((t) => requestedKeys.includes(t.key));
  const collections = await client.collections.list();
  const results: SeedResult[] = [];

  for (const target of targets) {
    const collection = findCollection(collections, target.collection);
    if (!collection) {
      results.push({
        key: target.key,
        label: target.label,
        created: 0,
        failed: 0,
        errors: [`No collection named "${target.collection}" in this account.`],
      });
      continue;
    }

    const fields = await client.collections.getFields(collection.id);
    const resolution = resolveFields(target, fields);
    if (resolution.missingRequired.length > 0) {
      results.push({
        key: target.key,
        label: target.label,
        created: 0,
        failed: 0,
        errors: [
          `"${target.collection}" is missing required field(s): ${resolution.missingRequired.join(', ')}.`,
        ],
      });
      continue;
    }

    const fieldIds = new Map(resolution.matched.map((m) => [m.name.toLowerCase(), m.id]));
    const rows = target.rows();
    const result: SeedResult = {
      key: target.key,
      label: target.label,
      created: 0,
      failed: 0,
      errors: [],
    };

    // Records are keyed by field UUID, and only fields this account actually
    // has are sent — anything unmatched is dropped rather than guessed at.
    const payloads = rows.map((row) => {
      const payload: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(row)) {
        const id = fieldIds.get(name.toLowerCase());
        if (id && value !== null && value !== undefined) payload[id] = value;
      }
      return payload;
    });

    for (let start = 0; start < payloads.length; start += WRITE_CONCURRENCY) {
      const batch = payloads.slice(start, start + WRITE_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((payload) => client.collections.records.create(collection.id, payload)),
      );
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          result.created += 1;
        } else {
          result.failed += 1;
          if (result.errors.length < 3) {
            result.errors.push(
              outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
            );
          }
        }
      }
    }

    results.push(result);
  }

  return NextResponse.json({ results, marker: SEED_MARKER });
}
