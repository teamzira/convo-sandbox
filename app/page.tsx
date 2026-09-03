/**
 * Coverage board — the one screen a workforce manager watches.
 *
 * Every open shift, how much lead time is left on it, how many interpreters
 * the policy set clears for it right now, and what the resulting utilization
 * looks like. Replaces the "callout becomes a ticket, then a round of manual
 * outreach across Slack and Rippling" loop.
 */
import Link from 'next/link';
import { ArrowRightIcon, CircleCheckIcon, TriangleAlertIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getCoverageMetrics,
  getInterpreterNames,
  getInterpreters,
  getShifts,
  getWeekCoverage,
  openCoverageHours,
  sandboxNow,
} from '@/lib/sandbox/data';
import { rankMatches, shiftHours } from '@/lib/sandbox/matching';
import {
  formatDay,
  formatElapsed,
  formatHours,
  formatLeadTime,
  formatPercent,
  formatTimeRange,
  formatUsd,
  urgencyOf,
} from '@/lib/sandbox/format';
import { PageHeader } from '@/components/coverage/page-header';
import { StatBar, StatCard } from '@/components/coverage/stat-card';
import { OriginBadge, StatusBadge, UrgencyBadge } from '@/components/coverage/badges';
import { AmrTrendChart } from '@/components/coverage/amr-trend-chart';
import { CushionChart } from '@/components/coverage/cushion-chart';

export default async function CoveragePage() {
  const now = sandboxNow();
  const [shifts, interpreters, metrics, names, week] = await Promise.all([
    getShifts(now),
    getInterpreters(now),
    getCoverageMetrics(now),
    getInterpreterNames(now),
    getWeekCoverage(now),
  ]);

  const openShifts = shifts
    .filter((s) => s.status !== 'filled')
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const coveredShifts = shifts
    .filter((s) => s.status === 'filled')
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  // Eligibility is evaluated per shift so the board shows how deep the bench
  // actually is, not just that something is unfilled.
  const eligibleCounts = new Map(
    openShifts.map((shift) => [
      shift.id,
      rankMatches(shift, interpreters, now).filter((m) => !m.blocked).length,
    ]),
  );

  const unfilledHours = openCoverageHours(shifts);
  const autoCoverRatio = metrics.calloutsAutoCovered / metrics.calloutsThisWeek;
  const amrGap = metrics.amrTarget - metrics.amrActual;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Coverage"
        description="Open shifts, automated interpreter matching, and utilization"
        active="/"
        showSeedAction
        actions={
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Sandbox data
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open shifts"
          value={String(metrics.openShiftCount)}
          detail={`${formatHours(unfilledHours)} unfilled · ${metrics.sameDayOpenCount} same day`}
          tone={metrics.sameDayOpenCount > 0 ? 'critical' : 'neutral'}
        />
        <StatCard
          label="Callouts auto-covered"
          value={formatPercent(autoCoverRatio, 0)}
          detail={`${metrics.calloutsAutoCovered} of ${metrics.calloutsThisWeek} callouts this week`}
          tone={autoCoverRatio >= 0.75 ? 'positive' : 'caution'}
          footer={<StatBar ratio={autoCoverRatio} tone={autoCoverRatio >= 0.75 ? 'positive' : 'caution'} />}
        />
        <StatCard
          label="Median time to fill"
          value={`${metrics.medianFillHours}h`}
          detail="Manual coverage baseline today"
        />
        <StatCard
          label="Active Minute Rate"
          value={formatPercent(metrics.amrActual)}
          detail={`${formatPercent(amrGap)} below the ${formatPercent(metrics.amrTarget, 0)} target`}
          tone={amrGap > 0.02 ? 'caution' : 'positive'}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Open coverage</CardTitle>
          <CardDescription>
            Ranked by how soon the shift starts. Eligible counts come from the{' '}
            <span className="font-medium">Open shift coverage</span> policy — credentials,
            jurisdiction, availability, rest periods and hour ceilings evaluated against every
            interpreter on the roster.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {openShifts.length === 0 ? (
            <EmptyCoverage />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Shift</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Lead time</TableHead>
                  <TableHead>Why open</TableHead>
                  <TableHead className="text-right">Eligible now</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {openShifts.map((shift) => {
                  const eligible = eligibleCounts.get(shift.id) ?? 0;
                  const urgency = urgencyOf(shift, now);
                  return (
                    <TableRow key={shift.id}>
                      <TableCell className="pl-6">
                        <div className="font-medium">{shift.queue}</div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono">{shift.code}</span> · {shift.site} ·{' '}
                          {shift.jurisdiction}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{formatDay(shift.startAt, now)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimeRange(shift.startAt, shift.endAt)} ·{' '}
                          {formatHours(shiftHours(shift))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <UrgencyBadge urgency={urgency} />
                          <span className="text-xs text-muted-foreground">
                            starts in {formatLeadTime(shift.startAt, now)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <OriginBadge origin={shift.origin} />
                          <span className="text-xs text-muted-foreground">
                            {shift.calloutReason
                              ? `${names[shift.previousInterpreterId ?? ''] ?? 'Interpreter'} — ${shift.calloutReason}, ${formatElapsed(shift.openedAt, now)}`
                              : `Opened ${formatElapsed(shift.openedAt, now)}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            eligible === 0
                              ? 'font-semibold tabular-nums text-red-600'
                              : eligible <= 2
                                ? 'font-semibold tabular-nums text-orange-700'
                                : 'font-semibold tabular-nums'
                          }
                        >
                          {eligible}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          of {interpreters.length}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={shift.status} />
                        {shift.offers.length > 0 ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {shift.offers.length} sent
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/shifts/${shift.id}`}>
                            Match
                            <ArrowRightIcon />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Minute Rate</CardTitle>
            <CardDescription>
              Billable interpreting minutes as a share of paid minutes — the rate the FCC
              reimburses against. Every hour of unworked coverage pulls it down.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AmrTrendChart data={metrics.amrTrend} target={metrics.amrTarget} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Scheduled hours vs. forecast demand</CardTitle>
            <CardDescription>
              {formatHours(metrics.cushionHours)} overstaffed this week —{' '}
              {formatUsd(metrics.cushionCostUsd)} paid and non-billable, held as cushion because
              same-day shifts are hard to fill. Select a day to see where it goes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CushionChart data={metrics.scheduledVsDemand} week={week} />
          </CardContent>
        </Card>
      </section>

      {coveredShifts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recently covered</CardTitle>
            <CardDescription>
              Callouts and gaps closed without a ticket — the offer went out, an eligible
              interpreter accepted, the shift reassigned itself.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {coveredShifts.map((shift) => {
              const accepted = shift.offers.find((o) => o.state === 'accepted');
              const fillHours = accepted
                ? (new Date(accepted.at).getTime() - new Date(shift.openedAt).getTime()) /
                  3_600_000
                : null;
              return (
                <div
                  key={shift.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <CircleCheckIcon className="size-4 text-green-600" />
                    <div>
                      <div className="text-sm font-medium">
                        {shift.queue}{' '}
                        <span className="font-mono text-xs text-muted-foreground">
                          {shift.code}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDay(shift.startAt, now)} ·{' '}
                        {formatTimeRange(shift.startAt, shift.endAt)} · covered by{' '}
                        {names[shift.assignedInterpreterId ?? ''] ?? 'an interpreter'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {fillHours !== null ? (
                      <>
                        filled in{' '}
                        <span className="font-medium text-foreground">
                          {fillHours < 1
                            ? `${Math.round(fillHours * 60)}m`
                            : `${fillHours.toFixed(1)}h`}
                        </span>
                      </>
                    ) : (
                      'filled'
                    )}
                    <div>
                      {shift.offers.length} offer{shift.offers.length === 1 ? '' : 's'} sent
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

function EmptyCoverage() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <TriangleAlertIcon className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">No open shifts</p>
      <p className="text-xs text-muted-foreground">
        Every published shift on the horizon has an interpreter assigned.
      </p>
    </div>
  );
}
