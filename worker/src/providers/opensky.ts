// OpenSky Network adapter — free, no key. Fallback live-position source. Raw
// units are SI and converted to knots/feet/fpm. `last_contact` is absolute
// epoch seconds. The state vector is a positional array.
import type { LivePosition, ProviderResult } from '../types';
import {
  numOrNull,
  msToKnots,
  metersToFeet,
  msToFpm,
  observedAtFromEpoch,
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
