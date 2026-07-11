// Fallback orchestration for the schedule -> status -> live-position chain.
// All provider access is injected so this module is fully import-testable
// without network or a running Worker.
import type { FlightBase, LivePosition, NormalizedFlight, ProviderResult } from './types';
import { canonicalKey } from './normalize';

export type FlightErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'rate_limited'
  | 'providers_unavailable';

// Provider functions are pre-bound with their API keys / clock by the caller.
export interface FlightServiceDeps {
  fetchAviationstack: (iataNumber: string, date: string) => Promise<ProviderResult<FlightBase>>;
  fetchAirlabs: (iataNumber: string, date: string) => Promise<ProviderResult<FlightBase>>;
  fetchAdsbPosition: (icao24: string) => Promise<ProviderResult<LivePosition>>;
  searchAdsbCallsign: (
    callsign: string,
  ) => Promise<{ position: ProviderResult<LivePosition>; icao24: string | null }>;
  fetchOpenSky: (icao24: string) => Promise<ProviderResult<LivePosition>>;
  now: () => number;
  requestId?: () => string;
}

export interface ScheduleResult {
  ok: true;
  base: FlightBase;
  source: 'aviationstack' | 'airlabs';
}
export interface ScheduleError {
  ok: false;
  httpStatus: number;
  code: FlightErrorCode;
  error: string;
}

// Capability-aware schedule resolution: Aviationstack first, then AirLabs only
// when Aviationstack failed in any way. Never merges the two paid providers.
export async function resolveSchedule(
  iataNumber: string,
  date: string,
  deps: FlightServiceDeps,
): Promise<ScheduleResult | ScheduleError> {
  let rateLimited = false;
  let respondedNoMatch = false;

  const track = (r: ProviderResult<FlightBase>): void => {
    if (r.ok) return;
    if (r.reason === 'rate_limited') rateLimited = true;
    // A provider that responded with record(s) that don't match the requested
    // date (or an unusable record) is evidence the flight is not found.
    if (r.reason === 'no_match' || r.reason === 'unusable') respondedNoMatch = true;
  };

  const av = await deps.fetchAviationstack(iataNumber, date);
  if (av.ok) return { ok: true, base: av.data, source: 'aviationstack' };
  track(av);

  const al = await deps.fetchAirlabs(iataNumber, date);
  if (al.ok) return { ok: true, base: al.data, source: 'airlabs' };
  track(al);

  // A rate-limited provider means the flight's existence is unknown, so retrying
  // (429) is preferred over a potentially-false 404.
  if (rateLimited) {
    return { ok: false, httpStatus: 429, code: 'rate_limited', error: 'All schedule providers are rate-limited' };
  }
  if (respondedNoMatch) {
    return { ok: false, httpStatus: 404, code: 'not_found', error: 'No schedule found for that flight and date' };
  }
  return { ok: false, httpStatus: 502, code: 'providers_unavailable', error: 'Schedule providers are unavailable' };
}

// Optional live position. adsb.lol first (by known ICAO24, else operational
// callsign); OpenSky only when adsb.lol has no usable position AND an ICAO24 is
// known. Position failures never fail the request.
export async function resolveLivePosition(
  base: FlightBase,
  deps: FlightServiceDeps,
): Promise<{ position: LivePosition | null; source: string | null }> {
  let knownIcao = base.icao24;
  let adsb: ProviderResult<LivePosition> | null = null;

  if (knownIcao) {
    adsb = await deps.fetchAdsbPosition(knownIcao);
  } else if (base.flightIcao) {
    const r = await deps.searchAdsbCallsign(base.flightIcao);
    adsb = r.position;
    if (r.icao24) knownIcao = r.icao24;
  }

  if (adsb && adsb.ok) {
    return { position: adsb.data, source: 'adsb.lol' };
  }

  if (knownIcao) {
    const os = await deps.fetchOpenSky(knownIcao);
    if (os.ok) return { position: os.data, source: 'opensky' };
  }

  return { position: null, source: null };
}

// Assemble the response envelope. ADS-B alone can never create a flight — this
// is only ever called with an authoritative schedule base.
export function toNormalizedFlight(
  base: FlightBase,
  serviceDate: string,
  position: LivePosition | null,
  positionSource: string | null,
  opts: { now: number; requestId: string; stale: boolean },
): NormalizedFlight {
  const dataSources = [base.statusSource];
  if (positionSource) dataSources.push(positionSource);

  return {
    requestId: opts.requestId,
    fetchedAt: new Date(opts.now).toISOString(),
    dataSources,
    stale: opts.stale,
    canonicalKey: canonicalKey(serviceDate, base.iataNumber),
    serviceDate,
    iataNumber: base.iataNumber,
    flightNumber: base.flightNumber,
    airlineIata: base.airlineIata,
    airlineName: base.airlineName,
    origin: base.origin,
    destination: base.destination,
    scheduledDeparture: base.scheduledDeparture,
    scheduledArrival: base.scheduledArrival,
    estimatedDeparture: base.estimatedDeparture,
    estimatedArrival: base.estimatedArrival,
    actualDeparture: base.actualDeparture,
    actualArrival: base.actualArrival,
    status: base.status,
    delayMinutes: base.delayMinutes,
    gate: base.gate,
    terminal: base.terminal,
    aircraft: base.aircraft,
    registration: base.registration,
    codeshare: base.codeshare,
    statusSource: base.statusSource,
    positionSource,
    livePosition: position,
  };
}

// End-to-end fresh snapshot: schedule (required) + optional live position.
export async function getFlightSnapshot(
  iataNumber: string,
  date: string,
  deps: FlightServiceDeps,
): Promise<{ ok: true; flight: NormalizedFlight } | ScheduleError> {
  const schedule = await resolveSchedule(iataNumber, date, deps);
  if (!schedule.ok) return schedule;

  const { position, source } = await resolveLivePosition(schedule.base, deps);
  const requestId = deps.requestId ? deps.requestId() : crypto.randomUUID();
  const flight = toNormalizedFlight(schedule.base, date, position, source, {
    now: deps.now(),
    requestId,
    stale: false,
  });
  return { ok: true, flight };
}
