'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const config = {
  demand: { label: 'Forecast demand', color: 'var(--chart-1)' },
  cushion: { label: 'Overstaffed cushion', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export function CushionChart({
  data,
}: {
  data: { day: string; scheduled: number; demand: number }[];
}) {
  const stacked = data.map((d) => ({
    day: d.day,
    demand: d.demand,
    cushion: Math.max(d.scheduled - d.demand, 0),
  }));

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={stacked} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
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
        <Bar dataKey="demand" stackId="hours" fill="var(--color-demand)" radius={[0, 0, 4, 4]} />
        <Bar dataKey="cushion" stackId="hours" fill="var(--color-cushion)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
