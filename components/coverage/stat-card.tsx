import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatTone = 'neutral' | 'positive' | 'caution' | 'critical';

const TONE_VALUE: Record<StatTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-green-700',
  caution: 'text-orange-700',
  critical: 'text-red-600',
};

export function StatCard({
  label,
  value,
  detail,
  tone = 'neutral',
  footer,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: StatTone;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="gap-0">
      <CardContent className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn('text-2xl font-semibold tabular-nums', TONE_VALUE[tone])}>{value}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
        {footer}
      </CardContent>
    </Card>
  );
}

/** Thin progress rail used under a stat, e.g. callouts auto-covered. */
export function StatBar({ ratio, tone = 'neutral' }: { ratio: number; tone?: StatTone }) {
  const fill = {
    neutral: 'bg-blue-500',
    positive: 'bg-green-500',
    caution: 'bg-orange-500',
    critical: 'bg-red-500',
  }[tone];
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full', fill)}
        style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }}
      />
    </div>
  );
}
