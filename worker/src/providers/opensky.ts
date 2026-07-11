// OpenSky Network adapter — free, no key. Fallback live-position source. Raw
// units are SI and converted to knots/feet/fpm. `last_contact` is absolute
// epoch seconds. The state vector is a positional array.
import type { InboundLegCore, LivePosition, ProviderResult } from '../types';
import {
  numOrNull,
  msToKnots,
  metersToFeet,
  msToFpm,
  observedAtFromEpoch,
  isoFromEpochSec,
  isPositionStale,
} from '../normalize';
import { recordSuccess, recordError } from '../providerState';
import type { FetchImpl } from './aviationstack';

// PURE mapper: OpenSky state-vector array -> LivePosition (null if no coords).
// Indices per the OpenSky /states/all contract:
//   [0]=icao24 [1]=callsign [4]=last_contact [5]=lon [6]=lat [7]=baro_altitude
//   [8]=on_ground [9]=velocity(m/s) [10]=true_track [11]=vertical_rate(m/s)
export function mapOpenSkyState(s: any[], nowMs: number): LivePosition | null {
  if (!Array.isArray(s)) return null;
  const lat = numOrNull(s[6]);
  const lon = numOrNull(s[5]);
  if (lat === null || lon === null) return null;

  const observedAt = observedAtFromEpoch(s[4], nowMs);
  const callsign = typeof s[1] === 'string' && s[1].trim() ? s[1].trim() : null;

  return {
    icao24: (s[0] ?? '').toString().toLowerCase(),
    callsign,
    latitude: lat,
    longitude: lon,
    altitudeFt: metersToFeet(s[7]),
    groundSpeedKt: msToKnots(s[9]),
    heading: numOrNull(s[10]),
    verticalRateFpm: msToFpm(s[11]),
    onGround: s[8] === true,
    observedAt,
    stale: isPositionStale(observedAt, nowMs),
    source: 'opensky',
  };
}

export async function fetchOpenSky(
  icao24: string,
  fetchImpl: FetchImpl = fetch,
  nowMs: number = Date.now(),
): Promise<ProviderResult<LivePosition>> {
  const url = `https://opensky-network.org/api/states/all?icao24=${encodeURIComponent(icao24.toLowerCase())}`;

  let resp: Response;
  try {
    resp = await fetchImpl(url);
  } catch {
    recordError('opensky', 'network error', nowMs);
    return { ok: false, reason: 'error', message: 'network error' };
  }
  if (resp.status === 429) {
    recordError('opensky', 'rate limited', nowMs);
    return { ok: false, reason: 'rate_limited', message: 'rate limited' };
  }
  if (resp.status === 401 || resp.status === 403) {
    recordError('opensky', 'authentication failed', nowMs);
    return { ok: false, reason: 'auth', message: 'authentication failed' };
  }
  if (!resp.ok) {
    recordError('opensky', `upstream ${resp.status}`, nowMs);
    return { ok: false, reason: 'error', message: `upstream ${resp.status}` };
  }

  let json: any;
  try {
    json = await resp.json();
  } catch {
    recordError('opensky', 'malformed response', nowMs);
    return { ok: false, reason: 'error', message: 'malformed response' };
  }

  const states: any[] = Array.isArray(json?.states) ? json.states : [];
  if (states.length === 0) {
    recordSuccess('opensky', nowMs);
    return { ok: false, reason: 'no_match' };
  }

  const pos = mapOpenSkyState(states[0], nowMs);
  if (!pos) {
    recordSuccess('opensky', nowMs);
    return { ok: false, reason: 'unusable', message: 'no coordinates' };
  }
  recordSuccess('opensky', nowMs);
  return { ok: true, data: pos };
}

// --- Inbound rotation (flights-by-aircraft) ---------------------------------
// A raw OpenSky leg from /flights/aircraft. `firstSeen`/`lastSeen` are epoch s;
// `estDepartureAirport`/`estArrivalAirport` are ICAO codes (or null).

// PURE: choose the aircraft's inbound leg. Prefer the most recent leg whose
// arrival airport matches (case-insensitive) and finished at/before `endSec`;
// otherwise fall back to the most recent leg finished at/before `endSec`.
export function pickInboundLeg(
  legs: any[],
  airportIcao: string | null,
  endSec: number,
): any | null {
  if (!Array.isArray(legs)) return null;

  const eligible = legs.filter((l) => {
    if (!l || typeof l !== 'object') return false;
    const ls = numOrNull(l.lastSeen);
    return ls !== null && ls <= endSec;
  });
  if (eligible.length === 0) return null;

  // Most recent first (by lastSeen).
  const byRecent = [...eligible].sort(
    (a, b) => (numOrNull(b.lastSeen) ?? 0) - (numOrNull(a.lastSeen) ?? 0),
  );

  if (airportIcao) {
    const want = airportIcao.toUpperCase();
    const match = byRecent.find(
      (l) =>
        typeof l.estArrivalAirport === 'string' &&
        l.estArrivalAirport.toUpperCase() === want,
    );
    if (match) return match;
  }

  return byRecent[0];
}

// PURE mapper: a raw OpenSky leg -> InboundLegCore.
export function mapInboundLeg(leg: any, icao24: string): InboundLegCore {
  const rawCallsign = typeof leg?.callsign === 'string' ? leg.callsign.trim() : '';
  const dep =
    typeof leg?.estDepartureAirport === 'string' && leg.estDepartureAirport.trim()
      ? leg.estDepartureAirport.trim()
      : null;
  const arr =
    typeof leg?.estArrivalAirport === 'string' && leg.estArrivalAirport.trim()
      ? leg.estArrivalAirport.trim()
      : null;

  return {
    flightIata: rawCallsign || null,
    originIcao: dep,
    originIata: null,
    destinationIcao: arr,
    scheduledArrival: null,
    arrivalEstimated: null,
    arrivalActual: isoFromEpochSec(leg?.lastSeen),
    icao24: (leg?.icao24 ?? icao24).toString().toLowerCase(),
    tail: null,
    source: 'opensky',
  };
}

// Find the aircraft's prior leg using OpenSky's free flights-by-aircraft API.
// Window: [before - 24h, before]. HTTPS, no key. Returns a discriminated
// ProviderResult so the router can 404/429/502 consistently.
export async function fetchInboundLeg(
  icao24: string,
  airportIcao: string | null,
  beforeMs: number,
  fetchImpl: FetchImpl = fetch,
  nowMs: number = Date.now(),
): Promise<ProviderResult<InboundLegCore>> {
  const end = Math.floor(beforeMs / 1000);
  const begin = end - 24 * 3600;
  const url =
    `https://opensky-network.org/api/flights/aircraft` +
    `?icao24=${encodeURIComponent(icao24.toLowerCase())}` +
    `&begin=${begin}&end=${end}`;

  let resp: Response;
  try {
    resp = await fetchImpl(url);
  } catch {
    recordError('opensky', 'network error', nowMs);
    return { ok: false, reason: 'error', message: 'network error' };
  }
  if (resp.status === 429) {
    recordError('opensky', 'rate limited', nowMs);
    return { ok: false, reason: 'rate_limited', message: 'rate limited' };
  }
  if (resp.status === 401 || resp.status === 403) {
    recordError('opensky', 'authentication failed', nowMs);
    return { ok: false, reason: 'auth', message: 'authentication failed' };
  }
  // OpenSky answers 404 when there are no flights in the window.
  if (resp.status === 404) {
    recordSuccess('opensky', nowMs);
    return { ok: false, reason: 'no_match' };
  }
  if (!resp.ok) {
    recordError('opensky', `upstream ${resp.status}`, nowMs);
    return { ok: false, reason: 'error', message: `upstream ${resp.status}` };
  }

  let json: any;
  try {
    json = await resp.json();
  } catch {
    recordError('opensky', 'malformed response', nowMs);
    return { ok: false, reason: 'error', message: 'malformed response' };
  }

  const legs: any[] = Array.isArray(json) ? json : [];
  const chosen = pickInboundLeg(legs, airportIcao, end);
  if (!chosen) {
    recordSuccess('opensky', nowMs);
    return { ok: false, reason: 'no_match' };
  }

  recordSuccess('opensky', nowMs);
  return { ok: true, data: mapInboundLeg(chosen, icao24) };
}
