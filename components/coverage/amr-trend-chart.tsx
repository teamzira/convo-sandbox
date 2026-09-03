'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const config = {
  amr: { label: 'Active Minute Rate', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export function AmrTrendChart({
  data,
  target,
}: {
  data: { week: string; amr: number; target: number }[];
  target: number;
}) {
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis
          domain={[0.6, 0.8]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tickLine={false}
          axisLine={false}
          width={40}
          fontSize={11}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `${(Number(value) * 100).toFixed(1)}%`}
            />
          }
        />
        <ReferenceLine
          y={target}
          stroke="var(--chart-4)"
          strokeDasharray="4 4"
          label={{
            value: `Target ${Math.round(target * 100)}%`,
            position: 'insideTopRight',
            fontSize: 11,
            fill: 'var(--chart-4)',
          }}
        />
        <Area
          dataKey="amr"
          type="monotone"
          fill="var(--color-amr)"
          fillOpacity={0.15}
          stroke="var(--color-amr)"
          strokeWidth={2}
        />
        <Line dataKey="amr" type="monotone" stroke="var(--color-amr)" dot={false} />
      </AreaChart>
    </ChartContainer>
  );
}
