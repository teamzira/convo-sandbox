/**
 * Presentation helpers. Pure formatting — no domain decisions live here.
 */
import type { Shift } from './types';
import { hoursUntil } from './matching';

export type Urgency = 'critical' | 'high' | 'standard';

/**
 * How hard this shift is to fill, by lead time. Same-day is the case that
 * currently becomes a ticket and a round of manual calls.
 */
export function urgencyOf(shift: Shift, now: Date): Urgency {
  const hours = hoursUntil(shift.startAt, now);
  if (hours <= 24) return 'critical';
  if (hours <= 72) return 'high';
  return 'standard';
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  critical: 'Under 24h',
  high: 'Within 72h',
  standard: 'This week',
};

export function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const time = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${time(start)} – ${time(end)}`;
}

export function formatDay(iso: string, now: Date): string {
  const d = new Date(iso);
  const days = Math.round(
    (new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatLeadTime(iso: string, now: Date): string {
  const hours = hoursUntil(iso, now);
  if (hours < 1) return `${Math.max(Math.round(hours * 60), 1)}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function formatElapsed(iso: string, now: Date): string {
  const hours = -hoursUntil(iso, now);
  if (hours < 1) return `${Math.max(Math.round(hours * 60), 1)}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatHours(hours: number): string {
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)}h`;
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
