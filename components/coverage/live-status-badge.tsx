'use client';

/**
 * The shift's status in the page header, kept in step with the offer panel.
 */
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShiftStatus } from '@/lib/sandbox/types';
import { useOfferSimulation } from './offer-simulation';

const LABEL: Record<ShiftStatus, string> = {
  open: 'No offers out',
  'offers-out': 'Offers out',
  filled: 'Covered',
};

const CLASS: Record<ShiftStatus, string> = {
  open: 'bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-slate-200',
  'offers-out': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
  filled: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200',
};

export function LiveStatusBadge({ status }: { status: ShiftStatus }) {
  const { phase } = useOfferSimulation();
  const live: ShiftStatus =
    phase === 'accepted' ? 'filled' : phase === 'sent' ? 'offers-out' : status;

  return (
    <Badge variant="secondary" className={cn('font-medium', CLASS[live])}>
      {LABEL[live]}
    </Badge>
  );
}
