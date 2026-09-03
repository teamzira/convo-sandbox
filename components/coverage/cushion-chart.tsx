'use client';

/**
 * Scheduled hours vs. forecast demand, by day, with a quarter-hour drill-down.
 *
 * The daily bars are sums of the same interval curve the drill-down renders,
 * so the two always agree. Clicking a day opens the detail because the daily
 * total hides the thing that matters: a day can look adequately staffed in
 * aggregate while being three interpreters short at 9am and four over at 3pm.
 */
import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  XAxis,
  YAxis,
} from 'recharts';
import { MaximizeIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  INTERVAL_MINUTES,
  shortfallWindows,
  type DayCoverage,
} from '@/lib/sandbox/intervals';

const dayConfig = {
  demand: { label: 'Forecast demand', color: 'var(--chart-1)' },
  cushion: { label: 'Scheduled above demand', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const intervalConfig = {
  demand: { label: 'Interpreters needed', color: 'var(--chart-1)' },
  scheduled: { label: 'Interpreters scheduled', color: 'var(--chart-3)' },
} satisfies ChartConfig;

/** Blended hourly cost used to price the cushion. */
const HOURLY_COST = 47;

function usd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function hours(value: number): string {
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}h`;
}

export function CushionChart({
  data,
  week,
}: {
  data: { day: string; scheduled: number; demand: number }[];
  week: DayCoverage[];
}) {
  const [openDay, setOpenDay] = useState<string | null>(null);

  const stacked = useMemo(
    () =>
      data.map((d) => ({
        day: d.day,
        demand: d.demand,
        cushion: Math.max(d.scheduled - d.demand, 0),
      })),
    [data],
  );

  const selected = week.find((d) => d.key === openDay) ?? null;

  // Typed loosely because Recharts' bar-event payload type carries the datum
  // on `payload` without exposing its shape.
  const handleBarClick = (entry: unknown) => {
    const day = (entry as { payload?: { day?: string } })?.payload?.day;
    if (day) setOpenDay(day);
  };

  return (
    <>
      <ChartContainer config={dayConfig} className="h-56 w-full">
        <BarChart
          data={stacked}
          margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
          className="cursor-pointer"
          // Clicking anywhere in a column opens that day, not just the bar itself.
          onClick={(state) => {
            if (state?.activeLabel != null) setOpenDay(String(state.activeLabel));
          }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            fontSize={11}
            tickFormatter={(v: number) => `${v}h`}
          />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}h`} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="demand"
            stackId="hours"
            fill="var(--color-demand)"
            radius={[0, 0, 4, 4]}
            onClick={handleBarClick}
          />
          <Bar
            dataKey="cushion"
            stackId="hours"
            fill="var(--color-cushion)"
            radius={[4, 4, 0, 0]}
            onClick={handleBarClick}
          />
        </BarChart>
      </ChartContainer>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MaximizeIcon className="size-3" />
        Select a day to break it down by {INTERVAL_MINUTES}-minute interval.
      </p>

      <Dialog open={openDay !== null} onOpenChange={(next) => !next && setOpenDay(null)}>
        <DialogContent className="flex h-[92vh] flex-col gap-4 overflow-hidden sm:max-w-[95vw]">
          {selected ? (
            <DayDetail day={selected} week={week} onSelectDay={setOpenDay} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DayDetail({
  day,
  week,
  onSelectDay,
}: {
  day: DayCoverage;
  week: DayCoverage[];
  onSelectDay: (key: string) => void;
}) {
  const windows = useMemo(() => shortfallWindows(day), [day]);
  const dateLabel = new Date(day.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {dateLabel}
          {day.weekend ? (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              Reduced weekend queue
            </Badge>
          ) : null}
        </DialogTitle>
        <DialogDescription>
          Interpreters scheduled against interpreters needed, in{' '}
          {INTERVAL_MINUTES}-minute intervals. Time above the demand line is paid and
          non-billable; time below it is billable minutes not earned.
        </DialogDescription>
      </DialogHeader>

      <div className="flex shrink-0 flex-wrap gap-1.5">
        {week.map((d) => (
          <Button
            key={d.key}
            size="sm"
            variant={d.key === day.key ? 'default' : 'outline'}
            onClick={() => onSelectDay(d.key)}
          >
            {d.label}
          </Button>
        ))}
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Scheduled"
          value={hours(day.scheduledHours)}
          detail={`${hours(day.demandHours)} of demand forecast`}
        />
        <Stat
          label="Overstaffed"
          value={hours(day.cushionHours)}
          detail={`${usd(day.cushionHours * HOURLY_COST)} paid, non-billable`}
          tone="caution"
          icon={<TrendingUpIcon className="size-3.5" />}
        />
        <Stat
          label="Understaffed"
          value={hours(day.shortfallHours)}
          detail={
            day.peakShortfall > 0
              ? `Peak gap of ${day.peakShortfall} interpreters`
              : 'Demand covered all day'
          }
          tone={day.shortfallHours > 0 ? 'critical' : 'positive'}
          icon={<TrendingDownIcon className="size-3.5" />}
        />
        <Stat
          label="Coverage ratio"
          value={`${Math.round((day.scheduledHours / day.demandHours) * 100)}%`}
          detail="Scheduled hours ÷ demand hours"
        />
      </div>

      <div className="min-h-0 flex-1">
        <ChartContainer config={intervalConfig} className="h-full w-full">
          <ComposedChart data={day.intervals} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
              interval={7}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={32}
              fontSize={11}
              allowDecimals={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => `${label} – ${label}`}
                  formatter={(value, name) => `${value} ${name === 'demand' ? 'needed' : 'on'}`}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />

            {/* Windows where demand outran the schedule. */}
            {windows.map((window) => (
              <ReferenceArea
                key={`${window.start}-${window.end}`}
                x1={window.start}
                x2={window.end}
                fill="var(--chart-4)"
                fillOpacity={0.1}
                stroke="none"
              />
            ))}

            <Area
              dataKey="demand"
              type="monotone"
              fill="var(--color-demand)"
              fillOpacity={0.18}
              stroke="var(--color-demand)"
              strokeWidth={2}
            />
            <Line
              dataKey="scheduled"
              type="stepAfter"
              stroke="var(--color-scheduled)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>

      {windows.length > 0 ? (
        <div className="shrink-0 space-y-2 overflow-y-auto">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Understaffed windows
          </p>
          <div className="flex flex-wrap gap-2">
            {windows.map((window) => (
              <div
                key={`${window.start}-${window.end}`}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs dark:border-red-800 dark:bg-red-950"
              >
                <span className="font-medium">
                  {window.start} – {window.end}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {window.minutes} min · short {window.peak}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Stat({
  label,
  value,
  detail,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'positive' | 'caution' | 'critical';
  icon?: React.ReactNode;
}) {
  const toneClass = {
    neutral: 'text-foreground',
    positive: 'text-green-700',
    caution: 'text-orange-700',
    critical: 'text-red-600',
  }[tone];

  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', toneClass)}>{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
