/**
 * Match & offer — one open shift, the full ranked pool, and the blast.
 *
 * The policy set is applied to every interpreter on the roster before the page
 * renders, so the scheduler sees who is clear, who is ranked where and why,
 * and who is excluded on which rule — instead of reconstructing it by hand
 * from Rippling, availability sheets and Slack threads.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  BanIcon,
  CalendarClockIcon,
  MapPinIcon,
  ShieldCheckIcon,
  UserMinusIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  getInterpreterNames,
  getInterpreters,
  getShift,
  sandboxNow,
} from '@/lib/sandbox/data';
import { failedBlockers, rankMatches, shiftHours } from '@/lib/sandbox/matching';
import { toCandidateView } from '@/lib/sandbox/view';
import {
  formatDay,
  formatElapsed,
  formatHours,
  formatLeadTime,
  formatTimeRange,
  urgencyOf,
} from '@/lib/sandbox/format';
import { OriginBadge, UrgencyBadge } from '@/components/coverage/badges';
import { OfferPanel } from '@/components/coverage/offer-panel';
import { OfferSimulationProvider } from '@/components/coverage/offer-simulation';
import { ActivityTimeline, type TimelineEvent } from '@/components/coverage/activity-timeline';
import { LiveStatusBadge } from '@/components/coverage/live-status-badge';

export default async function ShiftMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = sandboxNow();
  const shift = await getShift(id, now);
  if (!shift) notFound();

  const [interpreters, names] = await Promise.all([
    getInterpreters(now),
    getInterpreterNames(now),
  ]);

  const ranked = rankMatches(shift, interpreters, now);
  const eligible = ranked.filter((m) => !m.blocked);
  const excluded = ranked.filter((m) => m.blocked);
  const eligibleViews = eligible.map((m) => toCandidateView(m, shift));

  const urgency = urgencyOf(shift, now);
  const hours = shiftHours(shift);
  const shiftLabel = `${shift.queue} ${shift.code}`;

  const history: TimelineEvent[] = [
    {
      title: shift.origin === 'callout' ? 'Callout received' : 'Shift opened',
      detail: shift.calloutReason
        ? `${shift.calloutReason} — ${names[shift.previousInterpreterId ?? ''] ?? 'assigned interpreter'} released the shift`
        : 'Published without an assigned interpreter',
      at: formatElapsed(shift.openedAt, now),
    },
    ...shift.offers.map((offer) => ({
      title: `Offer ${offer.state} — ${names[offer.interpreterId] ?? offer.interpreterId}`,
      detail:
        offer.state === 'accepted'
          ? 'Shift assigned, remaining offers withdrawn'
          : 'Sent as part of a policy-matched blast',
      at: formatElapsed(offer.at, now),
    })),
  ];

  return (
    <OfferSimulationProvider
      initialSentIds={shift.offers.map((o) => o.interpreterId)}
      initiallySent={shift.status === 'offers-out'}
    >
      <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/">
            <ArrowLeftIcon />
            Coverage
          </Link>
        </Button>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{shift.queue}</h1>
          <span className="font-mono text-sm text-muted-foreground">{shift.code}</span>
          <UrgencyBadge urgency={urgency} />
          <OriginBadge origin={shift.origin} />
          <LiveStatusBadge status={shift.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {shift.calloutReason ? (
            <>
              {names[shift.previousInterpreterId ?? ''] ?? 'The assigned interpreter'} called out{' '}
              {formatElapsed(shift.openedAt, now)} — {shift.calloutReason.toLowerCase()}. Coverage
              needs to be found in {formatLeadTime(shift.startAt, now)}.
            </>
          ) : (
            <>
              Opened {formatElapsed(shift.openedAt, now)} and still unfilled. Starts in{' '}
              {formatLeadTime(shift.startAt, now)}.
            </>
          )}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {eligibleViews.length} interpreter{eligibleViews.length === 1 ? '' : 's'}{' '}
                {eligibleViews.length === 1 ? 'clears' : 'clear'} every blocking rule
              </CardTitle>
              <CardDescription>
                Ranked by the share of policy checks each interpreter passes. Hover a tag to see
                the subpolicy behind it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eligibleViews.length === 0 ? (
                <NoEligibleCandidates />
              ) : (
                <OfferPanel candidates={eligibleViews} shiftLabel={shiftLabel} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BanIcon className="size-4 text-muted-foreground" />
                Excluded by policy ({excluded.length})
              </CardTitle>
              <CardDescription>
                Every interpreter the rules removed, and the rule that removed them. Nothing is
                filtered silently.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {excluded.map((match) => (
                <div
                  key={match.interpreter.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-medium text-muted-foreground">
                      {match.interpreter.name}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {match.interpreter.homeRegion}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {failedBlockers(match).map((result) => (
                      <Badge
                        key={result.subpolicyId}
                        variant="outline"
                        className="font-normal text-muted-foreground"
                        title={result.name}
                      >
                        {result.message}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {shift.previousInterpreterId ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  <UserMinusIcon className="size-4" />
                  {names[shift.previousInterpreterId]} is excluded automatically — they called out
                  of this shift.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Shift</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Fact icon={<CalendarClockIcon className="size-4" />} label="When">
                {formatDay(shift.startAt, now)}, {formatTimeRange(shift.startAt, shift.endAt)}
                <div className="text-xs text-muted-foreground">
                  {formatHours(hours)} · {shift.billableMinutesForecast} billable minutes forecast
                </div>
              </Fact>
              <Separator />
              <Fact icon={<MapPinIcon className="size-4" />} label="Where">
                {shift.site}
                <div className="text-xs text-muted-foreground">
                  Governed by {shift.jurisdiction} labor rules
                </div>
              </Fact>
              <Separator />
              <Fact icon={<ShieldCheckIcon className="size-4" />} label="Requires">
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {shift.requiredCredentials.map((c) => (
                    <Badge key={c} variant="secondary" className="font-normal">
                      {c}
                    </Badge>
                  ))}
                  {shift.requiredLanguages.map((l) => (
                    <Badge key={l} variant="outline" className="font-normal">
                      {l}
                    </Badge>
                  ))}
                </div>
              </Fact>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Coverage activity</CardTitle>
              <CardDescription>Everything that has happened on this shift.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline events={history} />
            </CardContent>
          </Card>
        </div>
      </section>
      </main>
    </OfferSimulationProvider>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function NoEligibleCandidates() {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="text-sm font-medium">No interpreter clears every rule</p>
      <p className="mt-1 text-xs text-muted-foreground">
        This is the case that becomes a ticket today. Relax a soft rule on the Policies tab, or
        escalate — the excluded list below shows exactly which rule is binding.
      </p>
    </div>
  );
}
