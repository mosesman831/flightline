// Aviationstack adapter. Always HTTPS. Returns a discriminated ProviderResult so
// the fallback chain can reason about *why* no data was produced. Never logs or
// returns the API key.
import type { FlightBase, ProviderResult } from '../types';
import {
  normalizeStatus,
  toIsoOrNull,
  localDatePart,
  matchesDate,
  numOrNull,
} from '../normalize';
import { recordSuccess, recordError } from '../providerState';

export type FetchImpl = typeof fetch;

// PURE mapper: Aviationstack flight record -> FlightBase. Aviationstack emits
// ISO 8601 with offset already, so datetimes pass through validation.
export function mapAviationstackFlight(record: any, iataNumber: string): FlightBase | null {
  if (!record || typeof record !== 'object') return null;
  const dep = record.departure ?? {};
  const arr = record.arrival ?? {};

  const localDepartureDate =
    (typeof record.flight_date === 'string' ? record.flight_date : null) ??
    localDatePart(dep.scheduled);

  const hasRoute = Boolean(dep.iata || dep.icao || arr.iata || arr.icao || dep.scheduled);
  if (!hasRoute) return null;

  return {
    iataNumber,
    flightNumber: String(record.flight?.number ?? '').trim() || (iataNumber.match(/(\d+)$/)?.[1] ?? ''),
    airlineIata: (record.airline?.iata ?? '').toString().toUpperCase(),
    airlineName: record.airline?.name ?? record.airline?.iata ?? '',
    flightIcao: record.flight?.icao ? String(record.flight.icao).toUpperCase() : null,
    origin: {
      iata: dep.iata ?? '',
      icao: dep.icao ?? '',
      name: dep.airport ?? '',
    },
    destination: {
      iata: arr.iata ?? '',
      icao: arr.icao ?? '',
      name: arr.airport ?? '',
    },
    scheduledDeparture: toIsoOrNull(dep.scheduled),
    scheduledArrival: toIsoOrNull(arr.scheduled),
    estimatedDeparture: toIsoOrNull(dep.estimated),
    estimatedArrival: toIsoOrNull(arr.estimated),
    actualDeparture: toIsoOrNull(dep.actual),
    actualArrival: toIsoOrNull(arr.actual),
    localDepartureDate,
    status: normalizeStatus(record.flight_status),
    delayMinutes: numOrNull(dep.delay),
    gate: dep.gate ?? arr.gate ?? null,
    terminal: dep.terminal ?? arr.terminal ?? null,
    aircraft: record.aircraft?.iata ?? record.aircraft?.icao ?? null,
    registration: record.aircraft?.registration ?? null,
    icao24: record.aircraft?.icao24 ? String(record.aircraft.icao24).toLowerCase() : null,
    codeshare: record.flight?.codeshared?.flight_iata ?? null,
    statusSource: 'aviationstack',
  };
}

export async function fetchAviationstack(
  iataNumber: string,
  date: string,
  apiKey: string | undefined,
  fetchImpl: FetchImpl = fetch,
  nowMs: number = Date.now(),
): Promise<ProviderResult<FlightBase>> {
  if (!apiKey) {
    return { ok: false, reason: 'unconfigured' };
  }

  const url =
    `https://api.aviationstack.com/v1/flights` +
    `?access_key=${encodeURIComponent(apiKey)}` +
    `&flight_iata=${encodeURIComponent(iataNumber)}` +
    `&flight_date=${encodeURIComponent(date)}`;

  let resp: Response;
  try {
    resp = await fetchImpl(url);
  } catch {
    recordError('aviationstack', 'network error', nowMs);
    return { ok: false, reason: 'error', message: 'network error' };
  }

  if (resp.status === 401 || resp.status === 403) {
    recordError('aviationstack', 'authentication failed', nowMs);
    return { ok: false, reason: 'auth', message: 'authentication failed' };
  }
  if (resp.status === 429) {
    recordError('aviationstack', 'rate limited', nowMs);
    return { ok: false, reason: 'rate_limited', message: 'rate limited' };
  }
  if (!resp.ok) {
    recordError('aviationstack', `upstream ${resp.status}`, nowMs);
    return { ok: false, reason: 'error', message: `upstream ${resp.status}` };
  }

  let json: any;
  try {
    json = await resp.json();
  } catch {
    recordError('aviationstack', 'malformed response', nowMs);
    return { ok: false, reason: 'error', message: 'malformed response' };
  }

  if (json?.error) {
    const code = json.error?.code ?? json.error?.type ?? '';
    if (String(code).includes('access')) {
      recordError('aviationstack', 'authentication failed', nowMs);
      return { ok: false, reason: 'auth', message: 'authentication failed' };
    }
    if (String(code).includes('rate') || String(code).includes('usage')) {
      recordError('aviationstack', 'rate limited', nowMs);
      return { ok: false, reason: 'rate_limited', message: 'rate limited' };
    }
    recordError('aviationstack', 'provider error', nowMs);
    return { ok: false, reason: 'error', message: 'provider error' };
  }

  const data: any[] = Array.isArray(json?.data) ? json.data : [];
  if (data.length === 0) {
    recordSuccess('aviationstack', nowMs);
    return { ok: false, reason: 'no_match' };
  }

  // Prefer a record whose flight IATA matches exactly.
  const wanted = iataNumber.toUpperCase();
  const record =
    data.find((r) => (r?.flight?.iata ?? '').toString().toUpperCase() === wanted) ?? data[0];

  const base = mapAviationstackFlight(record, iataNumber);
  if (!base) {
    recordSuccess('aviationstack', nowMs);
    return { ok: false, reason: 'unusable', message: 'no route/schedule in record' };
  }

  // Independently verify the returned local departure date.
  if (!matchesDate(base.localDepartureDate, date)) {
    recordSuccess('aviationstack', nowMs);
    return { ok: false, reason: 'no_match', message: 'date mismatch' };
  }

  recordSuccess('aviationstack', nowMs);
  return { ok: true, data: base };
}
