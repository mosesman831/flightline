/**
 * Pure aggregate statistics over a set of flights.
 *
 * All functions here are deterministic and side-effect free so they can be
 * used both in the UI (Passport screen) and in tests.
 */
import type { Flight } from '../types/flight';
import { greatCircleMiles } from './geo';
import { getAirline } from '../data/airlines';

export interface FlightStats {
  totalFlights: number;
  totalMiles: number;
  uniqueAirports: number;
  uniqueCountries: number;
  airlines: { code: string; name: string; count: number }[]; // sorted desc
  topRoute: { route: string; count: number } | null;
  predictionAccuracy: { sampled: number; avgErrorMin: number | null }; // from flights with predictedDeparture & actualDeparture
}

/** Absolute difference in whole minutes between two ISO timestamps. */
function absMinutesBetween(a: string, b: string): number | null {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.abs(ta - tb) / 60000;
}

/**
 * Compute aggregate travel statistics for the supplied flights.
 *
 * Miles are the sum of great-circle miles per flight (origin↔destination).
 * Airports and countries are de-duplicated across every origin and
 * destination. Airlines are grouped by `airlineIata` (name resolved via
 * `getAirline`) and sorted by descending count. `topRoute` is the most
 * frequent "IATA→IATA" pairing. `predictionAccuracy` averages the absolute
 * minute error over flights that have both a predicted and actual departure.
 */
export function computeStats(flights: Flight[]): FlightStats {
  let totalMiles = 0;
  const airports = new Set<string>();
  const countries = new Set<string>();
  const airlineCounts = new Map<string, number>();
  const routeCounts = new Map<string, number>();

  let errorSum = 0;
  let sampled = 0;

  for (const flight of flights) {
    const { origin, destination } = flight;

    totalMiles += greatCircleMiles(origin.lat, origin.lon, destination.lat, destination.lon);

    if (origin.iata) airports.add(origin.iata);
    if (destination.iata) airports.add(destination.iata);
    if (origin.country) countries.add(origin.country);
    if (destination.country) countries.add(destination.country);

    const code = flight.airlineIata;
    if (code) airlineCounts.set(code, (airlineCounts.get(code) ?? 0) + 1);

    if (origin.iata && destination.iata) {
      const route = `${origin.iata}→${destination.iata}`;
      routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);
    }

    if (flight.predictedDeparture && flight.actualDeparture) {
      const err = absMinutesBetween(flight.predictedDeparture, flight.actualDeparture);
      if (err !== null) {
        errorSum += err;
        sampled += 1;
      }
    }
  }

  const airlines = [...airlineCounts.entries()]
    .map(([code, count]) => ({ code, name: getAirline(code).name, count }))
    .sort((a, b) => b.count - a.count);

  let topRoute: FlightStats['topRoute'] = null;
  for (const [route, count] of routeCounts) {
    if (!topRoute || count > topRoute.count) topRoute = { route, count };
  }

  const avgErrorMin = sampled > 0 ? Math.round(errorSum / sampled) : null;

  return {
    totalFlights: flights.length,
    totalMiles,
    uniqueAirports: airports.size,
    uniqueCountries: countries.size,
    airlines,
    topRoute,
    predictionAccuracy: { sampled, avgErrorMin },
  };
}
