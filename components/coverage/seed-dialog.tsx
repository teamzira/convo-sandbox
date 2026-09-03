'use client';

/**
 * Seed demo data into the connected account.
 *
 * Deliberately a two-step flow: opening the dialog runs a preflight that
 * reports what exists in the account and what would be written, and only then
 * offers the write. The Open API has no delete, so this is the last point at
 * which the operation is reversible without hand-cleaning Teambridge.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  LoaderCircleIcon,
  XCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { tbFetch } from '@/lib/teambridge/fetch';
import { cn } from '@/lib/utils';
import type {
  PreflightResponse,
  SeedResult,
  TargetPreflight,
} from '@/lib/sandbox/seed-contract';

type Phase = 'loading' | 'ready' | 'writing' | 'done' | 'failed';

export function SeedDialog() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<SeedResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreflight = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const response = await tbFetch('/api/seed');
      if (!response.ok) throw new Error(`Preflight failed (${response.status})`);
      const data = (await response.json()) as PreflightResponse;
      setPreflight(data);
      // Anything with a side effect beyond its own collection starts unchecked.
      setSelected(
        new Set(data.targets.filter((t) => t.seedable && !t.caution).map((t) => t.key)),
      );
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the seed endpoint');
      setPhase('failed');
    }
  }, []);

  useEffect(() => {
    if (open) void loadPreflight();
  }, [open, loadPreflight]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const seed = async () => {
    setPhase('writing');
    setError(null);
    try {
      const response = await tbFetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: Array.from(selected) }),
      });
      const data = (await response.json()) as { results?: SeedResult[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? `Seeding failed (${response.status})`);
      setResults(data.results ?? []);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seeding failed');
      setPhase('failed');
    }
  };

  const selectedTargets = (preflight?.targets ?? []).filter((t) => selected.has(t.key));
  const totalRows = selectedTargets.reduce((sum, t) => sum + t.rowCount, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setResults(null);
          setPhase('loading');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DatabaseIcon />
          Seed demo data
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Seed demo data</DialogTitle>
          <DialogDescription>
            Writes interpreters and shifts into the connected Teambridge account so the board
            runs on real records instead of fixtures.
          </DialogDescription>
        </DialogHeader>

        {phase === 'loading' ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : phase === 'done' && results ? (
          <SeedResults results={results} marker={preflight?.marker ?? '[SANDBOX]'} />
        ) : preflight && !preflight.configured ? (
          <Alert>
            <AlertTriangleIcon />
            <AlertTitle>No credentials configured</AlertTitle>
            <AlertDescription>
              <p>
                Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">TB_CLIENT_ID</code>{' '}
                and{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  TB_CLIENT_SECRET
                </code>{' '}
                in <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code>{' '}
                and restart the dev server. Until then the app runs on fixtures, which needs no
                account.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {preflight?.error ? (
              <Alert variant="destructive">
                <XCircleIcon />
                <AlertTitle>Could not read the account</AlertTitle>
                <AlertDescription>{preflight.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-3">
              {preflight?.targets.map((target) => (
                <TargetRow
                  key={target.key}
                  target={target}
                  checked={selected.has(target.key)}
                  onToggle={() => toggle(target.key)}
                  disabled={phase === 'writing'}
                />
              ))}
            </div>

            <Alert>
              <AlertTriangleIcon />
              <AlertTitle>This cannot be undone from here</AlertTitle>
              <AlertDescription>
                <p>
                  The Teambridge API this app uses can create records but not delete them. Seeded
                  rows carry{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    {preflight?.marker ?? '[SANDBOX]'}
                  </code>{' '}
                  in a text field where the collection has one, so you can find and remove them in
                  Teambridge — by hand.
                </p>
              </AlertDescription>
            </Alert>

            {error ? (
              <Alert variant="destructive">
                <XCircleIcon />
                <AlertTitle>Seeding failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {phase === 'done' ? (
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline" disabled={phase === 'writing'}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={seed}
                disabled={
                  phase === 'writing' ||
                  phase === 'loading' ||
                  !preflight?.configured ||
                  selected.size === 0
                }
              >
                {phase === 'writing' ? (
                  <>
                    <LoaderCircleIcon className="animate-spin" />
                    Writing {totalRows} records…
                  </>
                ) : (
                  `Create ${totalRows} records`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetRow({
  target,
  checked,
  onToggle,
  disabled,
}: {
  target: TargetPreflight;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const blocked = !target.found || !target.seedable;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3',
        blocked && 'opacity-60',
        checked && !blocked && 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30',
      )}
    >
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled || blocked}
        aria-label={`Seed ${target.label}`}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{target.label}</span>
          <Badge variant="outline" className="font-mono text-[11px] font-normal">
            {target.collection}
          </Badge>
          {target.found ? (
            <span className="text-xs text-muted-foreground">{target.rowCount} records</span>
          ) : (
            <Badge
              variant="secondary"
              className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200"
            >
              Collection not found
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{target.description}</p>

        {target.fields && target.fields.missingRequired.length > 0 ? (
          <p className="text-xs text-red-600">
            Missing required field{target.fields.missingRequired.length === 1 ? '' : 's'}:{' '}
            {target.fields.missingRequired.join(', ')}
          </p>
        ) : null}

        {target.fields && target.fields.missingOptional.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Not in this account, will be skipped: {target.fields.missingOptional.join(', ')}
          </p>
        ) : null}

        {target.caution ? (
          <p className="rounded-sm bg-orange-50 px-2 py-1.5 text-xs text-orange-800 dark:bg-orange-950 dark:text-orange-200">
            {target.caution}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SeedResults({ results, marker }: { results: SeedResult[]; marker: string }) {
  const created = results.reduce((sum, r) => sum + r.created, 0);
  const failed = results.reduce((sum, r) => sum + r.failed, 0);

  return (
    <div className="space-y-3">
      <Alert
        className={
          failed === 0
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
            : undefined
        }
      >
        {failed === 0 ? <CheckCircle2Icon className="text-green-600" /> : <AlertTriangleIcon />}
        <AlertTitle>
          {created} record{created === 1 ? '' : 's'} created
          {failed > 0 ? `, ${failed} failed` : ''}
        </AlertTitle>
        <AlertDescription>
          <p>
            Seeded rows are marked{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{marker}</code> in
            Teambridge. Reload the board to read them back.
          </p>
        </AlertDescription>
      </Alert>

      {results.map((result) => (
        <div key={result.key} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{result.label}</span>
            <span className="text-xs text-muted-foreground">
              {result.created} created{result.failed > 0 ? ` · ${result.failed} failed` : ''}
            </span>
          </div>
          {result.errors.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {result.errors.map((message, index) => (
                <li key={index} className="text-xs break-words text-red-600">
                  {message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
