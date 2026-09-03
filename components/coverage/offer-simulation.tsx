'use client';

/**
 * Shared state for the offer simulation on a shift page.
 *
 * The status badge, the offer panel and the activity timeline all reflect the
 * same blast, so sending an offer updates the whole page rather than one card.
 * In Teambridge this state arrives from the shift's offer records; the context
 * boundary is the same either way.
 */
import { createContext, useContext, useMemo, useState } from 'react';

export type OfferPhase = 'composing' | 'sent' | 'accepted';

export type SimulatedOffer = { id: string; name: string };

type OfferSimulation = {
  phase: OfferPhase;
  sentIds: Set<string>;
  accepted: SimulatedOffer | null;
  /** Offers sent in this session, as opposed to ones already on the record. */
  simulated: SimulatedOffer[];
  send: (offers: SimulatedOffer[]) => void;
  accept: (offer: SimulatedOffer) => void;
};

const OfferSimulationContext = createContext<OfferSimulation | null>(null);

export function OfferSimulationProvider({
  initialSentIds,
  initiallySent,
  children,
}: {
  initialSentIds: string[];
  /** True when the shift already had a blast out before this session. */
  initiallySent: boolean;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<OfferPhase>(initiallySent ? 'sent' : 'composing');
  const [simulated, setSimulated] = useState<SimulatedOffer[]>([]);
  const [accepted, setAccepted] = useState<SimulatedOffer | null>(null);

  const value = useMemo<OfferSimulation>(() => {
    const sentIds = new Set([...initialSentIds, ...simulated.map((o) => o.id)]);
    return {
      phase,
      sentIds,
      accepted,
      simulated,
      send: (offers) => {
        setSimulated(offers);
        setPhase('sent');
      },
      accept: (offer) => {
        setAccepted(offer);
        setPhase('accepted');
      },
    };
  }, [accepted, initialSentIds, phase, simulated]);

  return (
    <OfferSimulationContext.Provider value={value}>{children}</OfferSimulationContext.Provider>
  );
}

export function useOfferSimulation(): OfferSimulation {
  const context = useContext(OfferSimulationContext);
  if (!context) {
    throw new Error('useOfferSimulation must be used inside an OfferSimulationProvider');
  }
  return context;
}
