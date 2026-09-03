/**
 * Wire format for the seed endpoint.
 *
 * Lives here rather than in `app/api/seed/route.ts` so the client dialog can
 * import the types without pulling the route — and with it `next/headers` and
 * the API client — into the browser bundle.
 */

export type FieldResolution = {
  matched: { name: string; id: string }[];
  missingRequired: string[];
  missingOptional: string[];
};

export type TargetPreflight = {
  key: string;
  label: string;
  collection: string;
  description: string;
  caution?: string;
  found: boolean;
  collectionId: string | null;
  rowCount: number;
  fields: FieldResolution | null;
  /** False when a required field is missing — the UI disables the target. */
  seedable: boolean;
};

export type PreflightResponse = {
  configured: boolean;
  accountId: string;
  marker: string;
  targets: TargetPreflight[];
  error?: string;
};

export type SeedResult = {
  key: string;
  label: string;
  created: number;
  failed: number;
  /** First few failures, so a schema mismatch is diagnosable from the UI. */
  errors: string[];
};
