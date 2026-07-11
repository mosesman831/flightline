import type { Flight } from '../types/flight';

export function predictDelay(flight: Flight): {
  delayChance: number;
  predictedDeparture: string | null;
  predictedArrival: string | null;
  delayReasons: { type: 'inbound' | 'weather' | 'wind' | 'traffic' | 'airline' | 'atc' | 'crew' | 'maintenance'; severity: 'low' | 'medium' | 'high'; description: string; minutes: number }[];
} {
  let score = 0;
  const reasons: { type: 'inbound' | 'weather' | 'wind' | 'traffic' | 'airline' | 'atc' | 'crew' | 'maintenance'; severity: 'low' | 'medium' | 'high'; description: string; minutes: number }[] = [];

  // 1. Route historical factor
  const routeKey = `${flight.origin.iata}-${flight.destination.iata}`;
  const routeFactors: Record<string, number> = {
    'JFK-SFO': 25, 'SFO-JFK': 22, 'LHR-JFK': 15, 'JFK-LHR': 12,
    'ORD-LAX': 18, 'LAX-ORD': 20, 'ATL-LAX': 14, 'DEN-AUS': 8,
    'DXB-LHR': 10, 'SIN-FRA': 8, 'LHR-DXB': 8,
  };
  score += routeFactors[routeKey] ?? 10;

  // 2. Airline OTP factor
  const airlineFactors: Record<string, number> = {
    'DL': -5, 'AA': 2, 'UA': 3, 'WN': 0, 'B6': -2,
    'BA': 0, 'EK': -3, 'SQ': -8, 'LH': -2, 'AF': 2,
  };
  score += airlineFactors[flight.airlineIata] ?? 5;

  // 3. Time of day
  const depHour = new Date(flight.scheduledDeparture).getHours();
  if (depHour < 6) score -= 5;
  else if (depHour < 9) score -= 3;
  else if (depHour >= 17 && depHour < 20) score += 10;
  else if (depHour >= 20) score += 15;

  // 4. Inbound aircraft
  if (flight.inbound?.actualArrival && flight.inbound?.scheduledArrival) {
    const inDelay = (new Date(flight.inbound.actualArrival).getTime() - new Date(flight.inbound.scheduledArrival).getTime()) / 60000;
    if (inDelay > 10) {
      const addScore = Math.min(inDelay * 1.5, 40);
      score += addScore;
      reasons.push({ type: 'inbound', severity: addScore > 25 ? 'high' : 'medium', description: `Inbound aircraft arriving ${Math.round(inDelay)} min late from ${flight.inbound.origin.iata}`, minutes: Math.round(inDelay) });
    }
  }

  // 5. Weather
  const windGust = flight.pilotData?.windGustKts;
  if (windGust && windGust > 20) {
    score += 10;
    reasons.push({ type: 'wind', severity: 'medium', description: `Wind gusts of ${windGust} kts at ${flight.origin.iata}`, minutes: 10 });
  }
  if (flight.pilotData?.visibilityKm && flight.pilotData.visibilityKm < 5) {
    score += 15;
    reasons.push({ type: 'weather', severity: 'high', description: 'Low visibility at origin airport', minutes: 15 });
  }

  // 6. Already delayed
  if (flight.delayMinutes && flight.delayMinutes > 0) {
    score += flight.delayMinutes * 0.8;
    if (!reasons.some(r => r.type === 'airline')) {
      reasons.push({ type: 'airline', severity: flight.delayMinutes > 30 ? 'high' : 'medium', description: `Current delay of ${flight.delayMinutes} min`, minutes: flight.delayMinutes });
    }
  }

  // Clamp and add default reason
  const delayChance = Math.min(Math.max(Math.round(score), 0), 99);
  const minDelay = Math.round(score * 0.8);
  const totalDelay = reasons.reduce((sum, r) => sum + r.minutes, 0);
  const actualDelay = Math.max(totalDelay, minDelay);

  if (reasons.length === 0) {
    reasons.push({ type: 'airline', severity: 'low', description: 'Standard operational variability', minutes: 5 });
  }

  const predictedDeparture = flight.delayMinutes
    ? new Date(new Date(flight.scheduledDeparture).getTime() + actualDelay * 60000).toISOString()
    : null;

  return {
    delayChance,
    predictedDeparture,
    predictedArrival: predictedDeparture
      ? new Date(new Date(predictedDeparture).getTime() + (new Date(flight.scheduledArrival).getTime() - new Date(flight.scheduledDeparture).getTime())).toISOString()
      : null,
    delayReasons: reasons.sort((a, b) => b.minutes - a.minutes),
  };
}
