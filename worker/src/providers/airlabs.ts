// AirLabs adapter. Always HTTPS. Prefers the *_utc datetime fields (appending
// Z) and derives the local departure date from the non-utc dep_time. Returns a
// discriminated ProviderResult; never leaks the API key.
import type { FlightBase, ProviderResult } from '../types';
import {
  normalizeStatus,
  airlabsUtcToIso,
  localDatePart,
  matchesDate,
  numOrNull,
} from '../normalize';
import { recordSuccess, recordError } from '../providerState';
import type { FetchImpl } from './aviationstack';

// PURE mapper: AirLabs flight record -> FlightBase.
export function mapAirlabsFlight(record: any, iataNumber: string): FlightBase | null {
  if (!record || typeof record !== 'object') return null;

  const hasRoute = Boolean(
    record.dep_iata || record.dep_icao || record.arr_iata || record.arr_icao || record.dep_time_utc || record.dep_time,
  );
  if (!hasRoute) return null;

  const localDepartureDate = localDatePart(record.dep_time);

  return {
    iataNumber,
    flightNumber: String(record.flight_number ?? '').trim() || (iataNumber.match(/(\d+)$/)?.[1] ?? ''),
    airlineIata: (record.airline_iata ?? '').toString().toUpperCase(),
    airlineName: record.airline_name ?? record.airline_iata ?? '',
    flightIcao: record.flight_icao ? String(record.flight_icao).toUpperCase() : null,
    origin: {
      iata: record.dep_iata ?? '',
      icao: record.dep_icao ?? '',
      name: record.dep_name ?? '',
    },
    destination: {
      iata: record.arr_iata ?? '',
      icao: record.arr_icao ?? '',
      name: record.arr_name ?? '',
    },
    scheduledDeparture: airlabsUtcToIso(record.dep_time_utc),
    scheduledArrival: airlabsUtcToIso(record.arr_time_utc),
    estimatedDeparture: airlabsUtcToIso(record.dep_estimated_utc),
    estimatedArrival: airlabsUtcToIso(record.arr_estimated_utc),
    actualDeparture: airlabsUtcToIso(record.dep_actual_utc),
    actualArrival: airlabsUtcToIso(record.arr_actual_utc),
    localDepartureDate,
    status: normalizeStatus(record.status),
    delayMinutes: numOrNull(record.delayed) ?? numOrNull(record.dep_delayed),
    gate: record.dep_gate ?? record.arr_gate ?? null,
    terminal: record.dep_terminal ?? record.arr_terminal ?? null,
    aircraft: record.aircraft_icao ?? null,
    registration: record.reg_number ?? null,
    icao24: record.hex ? String(record.hex).toLowerCase() : null,
    codeshare: record.cs_flight_iata ?? null,
    statusSource: 'airlabs',
  };
}

export async function fetchAirlabs(
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
    `https://airlabs.co/api/v9/flight` +
    `?api_key=${encodeURIComponent(apiKey)}` +
    `&flight_iata=${encodeURIComponent(iataNumber)}`;

  let resp: Response;
  try {
    resp = await fetchImpl(url);
  } catch {
    recordError('airlabs', 'network error', nowMs);
    return { ok: false, reason: 'error', message: 'network error' };
  }

  if (resp.status === 401 || resp.status === 403) {
    recordError('airlabs', 'authentication failed', nowMs);
    return { ok: false, reason: 'auth', message: 'authentication failed' };
  }
  if (resp.status === 429) {
    recordError('airlabs', 'rate limited', nowMs);
    return { ok: false, reason: 'rate_limited', message: 'rate limited' };
  }
  if (!resp.ok) {
    recordError('airlabs', `upstream ${resp.status}`, nowMs);
    return { ok: false, reason: 'error', message: `upstream ${resp.status}` };
  }

  let json: any;
  try {
    json = await resp.json();
  } catch {
    recordError('airlabs', 'malformed response', nowMs);
    return { ok: false, reason: 'error', message: 'malformed response' };
  }

  if (json?.error) {
    const key = String(json.error?.key ?? json.error?.message ?? '').toLowerCase();
    if (key.includes('key') || key.includes('auth')) {
      recordError('airlabs', 'authentication failed', nowMs);
      return { ok: false, reason: 'auth', message: 'authentication failed' };
    }
    if (key.includes('limit') || key.includes('rate')) {
      recordError('airlabs', 'rate limited', nowMs);
      return { ok: false, reason: 'rate_limited', message: 'rate limited' };
    }
    // e.g. "Unknown flight" -> treat as no match.
    recordSuccess('airlabs', nowMs);
    return { ok: false, reason: 'no_match', message: 'no match' };
  }

  // AirLabs `flight` returns a single object; `flights` returns an array.
  const raw = json?.response;
  const record = Array.isArray(raw) ? raw[0] : raw;
  if (!record) {
    recordSuccess('airlabs', nowMs);
    return { ok: false, reason: 'no_match' };
  }

  const base = mapAirlabsFlight(record, iataNumber);
  if (!base) {
    recordSuccess('airlabs', nowMs);
    return { ok: false, reason: 'unusable', message: 'no route/schedule in record' };
  }

  if (!matchesDate(base.localDepartureDate, date)) {
    recordSuccess('airlabs', nowMs);
    return { ok: false, reason: 'no_match', message: 'date mismatch' };
  }

  recordSuccess('airlabs', nowMs);
  return { ok: true, data: base };
}
