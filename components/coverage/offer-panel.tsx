'use client';

/**
 * Offer blast composer.
 *
 * The scheduler reviews the ranked pool, trims it if they want, and sends one
 * offer to everyone at once. First acceptance takes the shift and the rest are
 * withdrawn — no ticket, no round of individual messages.
 *
 * Sending is simulated in the sandbox: state lives in this component. In
 * Teambridge this is an automation targeting POLICY_MATCHED_USERS, which runs
 * the matching policy against the shift and messages the top N directly.
 */
import { useMemo, useState } from 'react';
import {
  BadgeCheckIcon,
  CheckIcon,
  CircleCheckIcon,
  ClockIcon,
  MinusIcon,
  SendIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CandidateView } from '@/lib/sandbox/view';
import { useOfferSimulation } from './offer-simulation';

function usd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function OfferPanel({
  candidates,
  shiftLabel,
}: {
  candidates: CandidateView[];
  shiftLabel: string;
}) {
  /** Pre-select everyone the policy cleared without an overtime flag. */
  const defaultSelection = useMemo(
    () =>
      new Set(
        candidates.filter((c) => c.offerState === null && c.overtimeHours === 0).map((c) => c.id),
      ),
    [candidates],
  );

  const [selected, setSelected] = useState<Set<string>>(defaultSelection);
  const { phase, sentIds, accepted, send, accept } = useOfferSimulation();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const acceptedCandidate = candidates.find((c) => c.id === accepted?.id) ?? null;
  const selectedCandidates = candidates.filter((c) => selected.has(c.id));
  const cheapest = selectedCandidates.reduce<CandidateView | null>(
    (best, c) => (best === null || c.shiftCost < best.shiftCost ? c : best),
    null,
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {acceptedCandidate ? (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CircleCheckIcon className="text-green-600" />
            <AlertTitle>{acceptedCandidate.name} accepted — shift covered</AlertTitle>
            <AlertDescription>
              {shiftLabel} is assigned and the remaining {Math.max(sentIds.size - 1, 0)} offers
              were withdrawn automatically. No ticket was opened.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          {candidates.map((candidate, index) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              rank={index + 1}
              selectable={phase === 'composing' && candidate.offerState === null}
              checked={selected.has(candidate.id)}
              onToggle={() => toggle(candidate.id)}
              sent={sentIds.has(candidate.id)}
              accepted={accepted?.id === candidate.id}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4">
          <div className="text-sm">
            {phase === 'composing' ? (
              <>
                <span className="font-medium">{selected.size} interpreters</span> receive this
                offer at once
                {cheapest ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · lowest-cost option {usd(cheapest.shiftCost)}
                  </span>
                ) : null}
              </>
            ) : acceptedCandidate ? (
              <span className="text-muted-foreground">
                Covered at {usd(acceptedCandidate.shiftCost)} for the shift
              </span>
            ) : (
              <span className="text-muted-foreground">
                {sentIds.size} offers out · first acceptance assigns the shift
              </span>
            )}
          </div>

          {phase === 'composing' ? (
            <Button
              disabled={selected.size === 0}
              onClick={() =>
                send(
                  candidates
                    .filter((c) => selected.has(c.id))
                    .map((c) => ({ id: c.id, name: c.name })),
                )
              }
            >
              <SendIcon />
              Send {selected.size > 0 ? `${selected.size} offers` : 'offers'}
            </Button>
          ) : phase === 'sent' ? (
            <Button
              variant="outline"
              onClick={() => {
                const first =
                  candidates.find((c) => sentIds.has(c.id) && c.eligible) ?? candidates[0];
                if (first) accept({ id: first.id, name: first.name });
              }}
            >
              Simulate first acceptance
            </Button>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

function CandidateRow({
  candidate,
  rank,
  selectable,
  checked,
  onToggle,
  sent,
  accepted,
}: {
  candidate: CandidateView;
  rank: number;
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
  sent: boolean;
  accepted: boolean;
}) {
  const commitmentGap = candidate.committedWeeklyHours - candidate.scheduledWeeklyHours;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        accepted && 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950',
        !accepted &&
          checked &&
          selectable &&
          'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30',
      )}
    >
      <div className="pt-1">
        {selectable ? (
          <Checkbox
            checked={checked}
            onCheckedChange={onToggle}
            aria-label={`Include ${candidate.name} in this offer`}
          />
        ) : (
          <span className="flex size-4 items-center justify-center">
            {sent ? <CircleCheckIcon className="size-4 text-blue-500" /> : null}
          </span>
        )}
      </div>

      <span className="w-5 pt-1 text-right text-xs font-medium tabular-nums text-muted-foreground">
        {rank}
      </span>

      <Avatar className="mt-0.5 size-8">
        <AvatarFallback className="bg-slate-100 text-xs dark:bg-slate-850">
          {candidate.initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{candidate.name}</span>
          <span className="text-xs text-muted-foreground">
            {candidate.employmentStatus} · {candidate.homeRegion}
          </span>
          {accepted ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200">
              Accepted
            </Badge>
          ) : sent ? (
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
            >
              Offer sent
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {candidate.signals.map((signal) => (
            <Tooltip key={signal.name}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn(
                    'cursor-default gap-1 font-normal',
                    signal.state === 'PASS'
                      ? 'border-green-200 text-green-700 dark:border-green-800 dark:text-green-200'
                      : 'border-slate-200 text-muted-foreground dark:border-slate-800',
                  )}
                >
                  {signal.state === 'PASS' ? (
                    <CheckIcon className="size-3" />
                  ) : (
                    <MinusIcon className="size-3" />
                  )}
                  {signal.name}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">{signal.message}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3" />
            {candidate.scheduledWeeklyHours}h scheduled → {candidate.projectedWeeklyHours.toFixed(0)}h
            {commitmentGap > 0 ? ` of ${candidate.committedWeeklyHours}h guaranteed` : ''}
          </span>
          <span className="inline-flex items-center gap-1">
            <BadgeCheckIcon className="size-3" />
            {Math.round(candidate.reliability * 100)}% accept &amp; attend
          </span>
          <span className="font-medium text-foreground">
            {usd(candidate.shiftCost)}
            {candidate.overtimeHours > 0 ? (
              <span className="font-normal text-orange-700"> · includes overtime</span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="w-28 shrink-0 pt-1">
        <div className="text-right text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {Math.round(candidate.passPercentage * 100)}%
          </span>{' '}
          match
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${Math.round(candidate.passPercentage * 100)}%` }}
          />
        </div>
        <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
          {candidate.passedCount}/{candidate.evaluatedCount} rules
        </div>
      </div>
    </div>
  );
}
