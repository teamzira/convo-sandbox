import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShiftOrigin, ShiftStatus } from '@/lib/sandbox/types';
import { URGENCY_LABEL, type Urgency } from '@/lib/sandbox/format';

const URGENCY_CLASS: Record<Urgency, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200',
  standard: 'bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-slate-200',
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <Badge variant="secondary" className={cn('font-medium', URGENCY_CLASS[urgency])}>
      {URGENCY_LABEL[urgency]}
    </Badge>
  );
}

const ORIGIN_LABEL: Record<ShiftOrigin, string> = {
  callout: 'Callout',
  unfilled: 'Never filled',
  'demand-spike': 'Demand spike',
};

const ORIGIN_CLASS: Record<ShiftOrigin, string> = {
  callout: 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-200',
  unfilled: 'border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-200',
  'demand-spike': 'border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-200',
};

export function OriginBadge({ origin }: { origin: ShiftOrigin }) {
  return (
    <Badge variant="outline" className={cn('font-normal', ORIGIN_CLASS[origin])}>
      {ORIGIN_LABEL[origin]}
    </Badge>
  );
}

const STATUS_LABEL: Record<ShiftStatus, string> = {
  open: 'No offers out',
  'offers-out': 'Offers out',
  filled: 'Covered',
};

const STATUS_CLASS: Record<ShiftStatus, string> = {
  open: 'bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-slate-200',
  'offers-out': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
  filled: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200',
};

export function StatusBadge({ status }: { status: ShiftStatus }) {
  return (
    <Badge variant="secondary" className={cn('font-medium', STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
