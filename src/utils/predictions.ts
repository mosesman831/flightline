import type { Flight, DelayReason, DelaySeverity } from '../types/flight';

// ─────────────────────────────────────────────────────────────────────────────
// Labeled heuristic delay model.
//
// This is intentionally a coarse, deterministic heuristic — NOT a trained
// predictor. It combines a few grounded signals (reported delay, observed
// inbound lateness, live weather) with soft priors (route/airline/time-of-day)
// to produce a 0–99 "delay chance" and a ranked list of human-readable reasons.
//
// It never fabricates a specific predicted departure time unless there is a
// concrete, observed basis for one (a reported delay, or an inbound aircraft
// that has already landed late). Soft priors influence the risk score only.
// ─────────────────────────────────────────────────────────────────────────────

/** Soft per-route prior (extra risk points). Modestly expanded lookup table. */
const ROUTE_FACTORS: Record<string, number> = {
  'JFK-SFO': 25, 'SFO-JFK': 22, 'LHR-JFK': 15, 'JFK-LHR': 12,
  'ORD-LAX': 18, 'LAX-ORD': 20, 'ATL-LAX': 14, 'DEN-AUS': 8,
  'DXB-LHR': 10, 'SIN-FRA': 8, 'LHR-DXB': 8,
  // Additional common congested / long-haul pairs.
  'EWR-SFO': 24, 'SFO-EWR': 22, 'LGA-ORD': 20, 'ORD-LGA': 20,
  'BOS-LGA': 16, 'LGA-BOS': 16, 'LAX-JFK': 20, 'JFK-LAX': 18,
  'SFO-ORD': 16, 'ORD-SFO': 16, 'LHR-CDG': 6, 'CDG-LHR': 6,
  'AMS-LHR': 6, 'LHR-AMS': 6, 'FRA-LHR': 7, 'LHR-FRA': 7,
  'SYD-MEL': 9, 'MEL-SYD': 9, 'HKG-SIN': 6, 'NRT-HND': 4,
};

/** Soft per-airline prior (on-time reputation; negative = better). Expanded. */
const AIRLINE_FACTORS: Record<string, number> = {
  'DL': -5, 'AA': 2, 'UA': 3, 'WN': 0, 'B6': -2,
  'BA': 0, 'EK': -3, 'SQ': -8, 'LH': -2, 'AF': 2,
  // Additional carriers.
  'AS': -4, 'NK': 6, 'F9': 7, 'G4': 5, 'HA': -3,
  'QF': -2, 'NH': -6, 'JL': -6, 'KL': -1, 'QR': -4,
  'VS': 0, 'IB': 3, 'TK': 2, 'AC': 1, 'EY': -2,
};

/** Bucket a minutes figure into a coarse severity band. */
function severityForMinutes(minutes: number): DelaySeverity {
  if (minutes >= 40) return 'high';
  if (minutes >= 15) return 'medium';
  return 'low';
}

/** Parse an ISO timestamp to epoch ms, or null when unparseable. */
function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function predictDelay(flight: Flight): {
  delayChance: number;
  predictedDeparture: string | null;
  predictedArrival: string | null;
  delayReasons: DelayReason[];
} {
  let score = 0;
  const reasons: DelayReason[] = [];

  // Concrete, observed minutes we're willing to project into a predicted time.
  // Soft priors (route/airline/time/weather) deliberately do NOT feed this.
  let concreteMinutes = 0;

  // 1. Route historical prior.
  const routeKey = `${flight.origin.iata}-${flight.destination.iata}`;
  score += ROUTE_FACTORS[routeKey] ?? 10;

  // 2. Airline on-time prior.
  score += AIRLINE_FACTORS[flight.airlineIata] ?? 5;

  // 3. Time-of-day buckets (congestion tends to compound through the day).
  const depMs = ms(flight.scheduledDeparture);
  const depHour = depMs != null ? new Date(depMs).getHours() : NaN;
  if (Number.isFinite(depHour)) {
    if (depHour < 6) score -= 5;
    else if (depHour < 9) score -= 3;
    else if (depHour >= 17 && depHour < 20) score += 10;
    else if (depHour >= 20) score += 15;

    // Evening peak congestion is a genuine (if soft) risk factor worth surfacing.
    if (depHour >= 17 && depHour < 23) {
      const peakMinutes = depHour >= 20 ? 12 : 8;
      reasons.push({
        type: 'traffic',
        severity: 'low',
        description: `Evening peak congestion at ${flight.origin.iata}`,
        minutes: peakMinutes,
      });
    }
  }

  // 4. Inbound aircraft lateness (observed). Uses actualArrival when present,
  //    falling back to scheduledArrival (which yields zero lateness).
  if (flight.inbound) {
    const sched = ms(flight.inbound.scheduledArrival);
    const ref = ms(flight.inbound.actualArrival ?? flight.inbound.scheduledArrival);
    if (sched != null && ref != null) {
      const inLate = Math.round((ref - sched) / 60000);
      if (inLate > 10) {
        score += Math.min(inLate * 1.5, 40);
        // A late inbound is a concrete basis: turnaround can absorb a little,
        // but most of the lateness typically propagates to the next departure.
        concreteMinutes = Math.max(concreteMinutes, Math.max(inLate - 5, 0));
        reasons.push({
          type: 'inbound',
          severity: severityForMinutes(inLate),
          description: `Inbound aircraft from ${flight.inbound.origin.iata} arriving ${inLate} min late`,
          minutes: inLate,
        });
      }
    }
  }

  // 5. Live weather from pilot data.
  const gust = flight.pilotData?.windGustKts;
  if (gust != null && gust > 20) {
    const strong = gust > 35;
    score += strong ? 15 : 10;
    reasons.push({
      type: 'wind',
      severity: strong ? 'high' : 'medium',
      description: `Wind gusts of ${Math.round(gust)} kts at ${flight.origin.iata}`,
      minutes: strong ? 20 : 12,
    });
  }
  const vis = flight.pilotData?.visibilityKm;
  if (vis != null && vis < 5) {
    const lowVis = vis < 2;
    score += lowVis ? 20 : 15;
    reasons.push({
      type: 'weather',
      severity: lowVis ? 'high' : 'medium',
      description: `Low visibility (${vis} km) at ${flight.origin.iata}`,
      minutes: lowVis ? 25 : 15,
    });
  }

  // 6. Already-delayed signals.
  if (flight.delayMinutes != null && flight.delayMinutes > 0) {
    score += flight.delayMinutes * 0.8;
    concreteMinutes = Math.max(concreteMinutes, flight.delayMinutes);
    if (!reasons.some((r) => r.type === 'airline')) {
      reasons.push({
        type: 'airline',
        severity: severityForMinutes(flight.delayMinutes),
        description: `Reported delay of ${flight.delayMinutes} min`,
        minutes: flight.delayMinutes,
      });
    }
  } else if (flight.status === 'delayed') {
    // Flagged delayed but no minutes reported: raise risk without inventing a time.
    score += 25;
    if (!reasons.some((r) => r.type === 'airline')) {
      reasons.push({
        type: 'airline',
        severity: 'medium',
        description: 'Flight flagged as delayed by the airline',
        minutes: 15,
      });
    }
  }

  const delayChance = Math.min(Math.max(Math.round(score), 0), 99);

  if (reasons.length === 0) {
    reasons.push({
      type: 'airline',
      severity: 'low',
      description: 'Standard operational variability',
      minutes: 5,
    });
  }

  // Only project a predicted time when we have a concrete, observed basis.
  const predictedDeparture =
    concreteMinutes > 0 && depMs != null
      ? new Date(depMs + concreteMinutes * 60000).toISOString()
      : null;

  const arrMs = ms(flight.scheduledArrival);
  const predictedArrival =
    predictedDeparture != null && depMs != null && arrMs != null
      ? new Date(Date.parse(predictedDeparture) + (arrMs - depMs)).toISOString()
      : null;

  // Rank by minutes desc, then severity desc as a tie-breaker for stability.
  const severityRank: Record<DelaySeverity, number> = { high: 3, medium: 2, low: 1 };
  reasons.sort(
    (a, b) => b.minutes - a.minutes || severityRank[b.severity] - severityRank[a.severity],
  );

  return { delayChance, predictedDeparture, predictedArrival, delayReasons: reasons };
}
