'use client';

/**
 * Everything that has happened on a shift — the record from the server plus
 * anything sent during this session.
 */
import { useOfferSimulation } from './offer-simulation';

export type TimelineEvent = {
  title: string;
  detail: string;
  at: string;
};

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  const { simulated, accepted, phase } = useOfferSimulation();

  const simulatedEvents: TimelineEvent[] = [];
  if (simulated.length > 0) {
    simulatedEvents.push({
      title: `${simulated.length} offer${simulated.length === 1 ? '' : 's'} sent`,
      detail: `Blast went to ${simulated.map((o) => o.name).join(', ')}`,
      at: 'just now',
    });
  }
  if (accepted) {
    simulatedEvents.push({
      title: `Offer accepted — ${accepted.name}`,
      detail: 'Shift assigned, remaining offers withdrawn',
      at: 'just now',
    });
  }

  const all = [...events, ...simulatedEvents];
  const showPlaceholder = all.length === 0 || (events.length <= 1 && phase === 'composing');

  return (
    <ol className="space-y-3">
      {all.map((event, index) => (
        <TimelineItem key={`${event.title}-${index}`} {...event} />
      ))}
      {showPlaceholder ? (
        <TimelineItem
          title="No offers sent yet"
          detail="Send the blast to start the clock"
          at=""
          muted
        />
      ) : null}
    </ol>
  );
}

function TimelineItem({
  title,
  detail,
  at,
  muted,
}: TimelineEvent & { muted?: boolean }) {
  return (
    <li className="flex gap-3">
      <span
        className={
          muted
            ? 'mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/30'
            : 'mt-1.5 size-2 shrink-0 rounded-full bg-blue-500'
        }
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {at ? <span className="shrink-0 text-xs text-muted-foreground">{at}</span> : null}
    </li>
  );
}
