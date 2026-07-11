import type { Flight } from '../types/flight';

/**
 * A grouped set of flights that belong to the same journey (SPEC §12.4a).
 * `flights` is always ordered by effective departure; `startDate`/`endDate`
 * are ISO strings for the first leg's departure and last leg's arrival.
 */
export interface TripGroup {
  id: string;
  label: string;
  flights: Flight[];
  startDate: string;
  endDate: string;
}

const ARROW = ' \u2192 '; // →
const ROUND = ' \u21c4 '; // ⇄
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CONNECTION_WINDOW_MS = 24 * HOUR_MS;
const ROUND_TRIP_WINDOW_MS = 14 * DAY_MS;

/** Effective departure epoch (ms): predicted when available, else scheduled. */
function departureMs(flight: Flight): number {
  return new Date(flight.predictedDeparture ?? flight.scheduledDeparture).getTime();
}

/** Effective arrival epoch (ms): predicted when available, else scheduled. */
function arrivalMs(flight: Flight): number {
  return new Date(flight.predictedArrival ?? flight.scheduledArrival).getTime();
}

/** Deterministic ordering by effective departure, breaking ties on id. */
function byDeparture(a: Flight, b: Flight): number {
  return departureMs(a) - departureMs(b) || a.id.localeCompare(b.id);
}

type GroupKind = 'single' | 'multi' | 'roundtrip';

/** Build a {@link TripGroup} from legs, deriving its label from `kind`. */
function makeGroup(legs: Flight[], kind: GroupKind): TripGroup {
  const ordered = [...legs].sort(byDeparture);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  let label: string;
  if (kind === 'roundtrip') {
    label = `${first.origin.iata}${ROUND}${first.destination.iata}`;
  } else if (ordered.length === 1) {
    label = `${first.origin.iata}${ARROW}${first.destination.iata}`;
  } else {
    const codes = [first.origin.iata, ...ordered.map((leg) => leg.destination.iata)];
    label = codes.join(ARROW);
  }

  return {
    id: `trip:${ordered.map((leg) => leg.id).join('+')}`,
    label,
    flights: ordered,
    startDate: first.predictedDeparture ?? first.scheduledDeparture,
    endDate: last.predictedArrival ?? last.scheduledArrival,
  };
}

/**
 * Group flights into trips (SPEC §12.4a). Pure and deterministic.
 *
 * Legs chain when flight A's destination IATA equals flight B's origin IATA and
 * B departs at/after A's arrival within 24h, forming a connection trip. Any two
 * remaining standalone flights that form A→B then B→A within 14 days become a
 * round trip. All other flights become single-leg groups. Groups are ordered by
 * first departure and no flight appears in more than one group.
 */
export function groupIntoTrips(flights: Flight[]): TripGroup[] {
  const sorted = [...flights].sort(byDeparture);
  const used = new Set<string>();

  // 1. Greedy 24h connection chaining.
  const chains: Flight[][] = [];
  for (const start of sorted) {
    if (used.has(start.id)) continue;
    used.add(start.id);
    const chain = [start];
    let last = start;

    for (;;) {
      let next: Flight | null = null;
      for (const cand of sorted) {
        if (used.has(cand.id)) continue;
        if (cand.origin.iata !== last.destination.iata) continue;
        const gap = departureMs(cand) - arrivalMs(last);
        if (gap < 0 || gap > CONNECTION_WINDOW_MS) continue;
        if (next === null || byDeparture(cand, next) < 0) next = cand;
      }
      if (next === null) break;
      used.add(next.id);
      chain.push(next);
      last = next;
    }

    chains.push(chain);
  }

  const singles = chains.filter((c) => c.length === 1).map((c) => c[0]).sort(byDeparture);
  const multiChains = chains.filter((c) => c.length > 1);

  // 2. Round-trip detection among standalone singles (A→B then B→A within 14d).
  const claimed = new Set<string>();
  const groups: TripGroup[] = [];
  for (const out of singles) {
    if (claimed.has(out.id)) continue;
    let ret: Flight | null = null;
    for (const cand of singles) {
      if (claimed.has(cand.id) || cand.id === out.id) continue;
      if (cand.origin.iata !== out.destination.iata) continue;
      if (cand.destination.iata !== out.origin.iata) continue;
      if (departureMs(cand) < arrivalMs(out)) continue;
      if (departureMs(cand) - departureMs(out) > ROUND_TRIP_WINDOW_MS) continue;
      ret = cand; // `singles` is sorted, so the first match departs earliest
      break;
    }
    if (ret) {
      claimed.add(out.id);
      claimed.add(ret.id);
      groups.push(makeGroup([out, ret], 'roundtrip'));
    } else {
      claimed.add(out.id);
      groups.push(makeGroup([out], 'single'));
    }
  }

  // 3. Multi-leg connection chains.
  for (const chain of multiChains) groups.push(makeGroup(chain, 'multi'));

  // 4. Order groups by first departure (deterministic tie-break on id).
  groups.sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime() || a.id.localeCompare(b.id),
  );
  return groups;
}

export type ConnectionStatus = 'comfortable' | 'close' | 'tight' | 'impossible';

/** Result of {@link computeConnection}: layover length and how safe it is. */
export interface ConnectionInfo {
  minutes: number;
  status: ConnectionStatus;
  label: string;
  sameAirport: boolean;
}

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  comfortable: 'Comfortable connection',
  close: 'Close connection',
  tight: 'Tight connection',
  impossible: 'Impossible connection',
};

/** Format a minute count as "45m" or "1h 05m". */
function formatLayover(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

/**
 * Compute the connection between an arriving leg and the next departing leg.
 *
 * Returns null when the departing origin does not match the arriving
 * destination IATA, or when the times are out of order / invalid. Uses
 * predicted times when available, else scheduled. Minimum connection time is
 * 45m domestic, or 90m when the connection spans an international transition
 * (arriving origin country differs from departing destination country). Status
 * thresholds: `< MCT` impossible, `< MCT+20` tight, `< MCT+60` close, else
 * comfortable.
 */
export function computeConnection(arriving: Flight, departing: Flight): ConnectionInfo | null {
  if (departing.origin.iata !== arriving.destination.iata) return null;

  const arr = arrivalMs(arriving);
  const dep = departureMs(departing);
  if (!(dep >= arr)) return null; // out-of-order or NaN times

  const minutes = Math.round((dep - arr) / 60000);
  const isInternational = arriving.origin.country !== departing.destination.country;
  const mct = isInternational ? 90 : 45;

  let status: ConnectionStatus;
  if (minutes < mct) status = 'impossible';
  else if (minutes < mct + 20) status = 'tight';
  else if (minutes < mct + 60) status = 'close';
  else status = 'comfortable';

  return {
    minutes,
    status,
    label: `${formatLayover(minutes)} layover \u2022 ${STATUS_TEXT[status]}`,
    sameAirport: departing.origin.iata === arriving.destination.iata,
  };
}
