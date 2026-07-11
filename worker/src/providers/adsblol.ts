// adsb.lol adapter — free community ADS-B, no key. Primary live-position source.
// Units are already normalized by the provider (gs=knots, alt_baro=feet,
// baro_rate=fpm); `seen` is seconds-ago and converted to an absolute timestamp.
import type { LivePosition, ProviderResult } from '../types';
import { numOrNull, observedAtFromSeen, isPositionStale } from '../normalize';
import { recordSuccess, recordError } from '../providerState';
import type { FetchImpl } from './aviationstack';

// PURE mapper: adsb.lol aircraft object -> LivePosition (or null if unusable,
// i.e. missing coordinates). Still exposes icao24 separately for callsign flows.
export function mapAdsbAircraft(ac: any, nowMs: number): LivePosition | null {
  if (!ac || typeof ac !== 'object') return null;
  const lat = numOrNull(ac.lat);
  const lon = numOrNull(ac.lon);
  if (lat === null || lon === null) return null;

  const onGround = ac.alt_baro === 'ground';
  const observedAt = observedAtFromSeen(ac.seen, nowMs);

  return {
    icao24: (ac.hex ?? ac.icao24 ?? '').toString().toLowerCase(),
    callsign: typeof ac.flight === 'string' && ac.flight.trim() ? ac.flight.trim() : null,
    latitude: lat,
    longitude: lon,
    altitudeFt: onGround ? 0 : numOrNull(ac.alt_baro),
    groundSpeedKt: numOrNull(ac.gs),
    heading: numOrNull(ac.track),
    verticalRateFpm: numOrNull(ac.baro_rate),
    onGround,
    observedAt,
    stale: isPositionStale(observedAt, nowMs),
    source: 'adsb.lol',
  };
}

function extractIcao24(ac: any): string | null {
  if (!ac || typeof ac !== 'object') return null;
  const hex = (ac.hex ?? ac.icao24 ?? '').toString().trim().toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? hex : null;
}

async function fetchAircraft(
  url: string,
  fetchImpl: FetchImpl,
  nowMs: number,
): Promise<{ ok: true; ac: any } | { ok: false; result: ProviderResult<LivePosition> }> {
  let resp: Response;
  try {
    resp = await fetchImpl(url);
  } catch {
    recordError('adsb.lol', 'network error', nowMs);
    return { ok: false, result: { ok: false, reason: 'error', message: 'network error' } };
  }
  if (resp.status === 429) {
    recordError('adsb.lol', 'rate limited', nowMs);
    return { ok: false, result: { ok: false, reason: 'rate_limited', message: 'rate limited' } };
  }
  if (!resp.ok) {
    recordError('adsb.lol', `upstream ${resp.status}`, nowMs);
    return { ok: false, result: { ok: false, reason: 'error', message: `upstream ${resp.status}` } };
  }
  let json: any;
  try {
    json = await resp.json();
  } catch {
    recordError('adsb.lol', 'malformed response', nowMs);
    return { ok: false, result: { ok: false, reason: 'error', message: 'malformed response' } };
  }
  const ac = Array.isArray(json?.ac) ? json.ac[0] : undefined;
  if (!ac) {
    recordSuccess('adsb.lol', nowMs);
    return { ok: false, result: { ok: false, reason: 'no_match' } };
  }
  return { ok: true, ac };
}

// Look up a live position by ICAO24 hex.
export async function fetchAdsbPosition(
  icao24: string,
  fetchImpl: FetchImpl = fetch,
  nowMs: number = Date.now(),
): Promise<ProviderResult<LivePosition>> {
  const url = `https://api.adsb.lol/v2/icao/${encodeURIComponent(icao24.toLowerCase())}`;
  const res = await fetchAircraft(url, fetchImpl, nowMs);
  if (!res.ok) return res.result;

  const pos = mapAdsbAircraft(res.ac, nowMs);
  if (!pos) {
    recordSuccess('adsb.lol', nowMs);
    return { ok: false, reason: 'unusable', message: 'no coordinates' };
  }
  recordSuccess('adsb.lol', nowMs);
  return { ok: true, data: pos };
}

// Search by operational callsign. Returns both the position result and any
// discovered ICAO24 so the orchestrator can fall through to OpenSky when a hex
// is known but no usable position exists.
export async function searchAdsbCallsign(
  callsign: string,
  fetchImpl: FetchImpl = fetch,
  nowMs: number = Date.now(),
): Promise<{ position: ProviderResult<LivePosition>; icao24: string | null }> {
  const url = `https://api.adsb.lol/v2/callsign/${encodeURIComponent(callsign.toUpperCase())}`;
  const res = await fetchAircraft(url, fetchImpl, nowMs);
  if (!res.ok) return { position: res.result, icao24: null };

  const icao24 = extractIcao24(res.ac);
  const pos = mapAdsbAircraft(res.ac, nowMs);
  if (!pos) {
    recordSuccess('adsb.lol', nowMs);
    return { position: { ok: false, reason: 'unusable', message: 'no coordinates' }, icao24 };
  }
  recordSuccess('adsb.lol', nowMs);
  return { position: { ok: true, data: pos }, icao24 };
}
