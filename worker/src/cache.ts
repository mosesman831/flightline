// Cloudflare Cache API wrapper (caches.default) plus PURE, unit-testable TTL
// helpers. Cache keys are versioned synthetic request URLs that never contain
// secret material.
import type { FlightStatus } from './types';

// Logical TTLs (seconds). "Logical" freshness is decided by the stored
// `x-cached-at` header + these values, independent of the physical store TTL.
export const POSITION_TTL_SECONDS = 15;
export const WEATHER_TTL_SECONDS = 600;
export const NOT_FOUND_TTL_SECONDS = 30;
export const INBOUND_TTL_SECONDS = 300;
export const INBOUND_NOT_FOUND_TTL_SECONDS = 60;
export const NAS_TTL_SECONDS = 120;

// Status physical store TTL: keep the last successful copy for 15 minutes so it
// can be served as stale-if-error after an upstream failure.
export const STATUS_PHYSICAL_TTL_SECONDS = 900;
export const STATUS_STALE_MAX_MS = 15 * 60 * 1000;

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

// PURE: logical status TTL based on status and time-to-departure.
export function statusTtlSeconds(
  status: FlightStatus,
  scheduledDeparture: string | null,
  nowMs: number,
): number {
  switch (status) {
    case 'active':
    case 'boarding':
    case 'delayed':
      return 45;
    case 'landed':
    case 'cancelled':
    case 'diverted':
      return 1800;
    case 'scheduled': {
      if (scheduledDeparture) {
        const depMs = Date.parse(scheduledDeparture);
        if (!Number.isNaN(depMs) && depMs - nowMs > THREE_HOURS_MS) {
          return 300;
        }
      }
      return 45;
    }
    default:
      return 45;
  }
}

// --- Canonical cache keys (no secrets) --------------------------------------

const CACHE_BASE = 'https://flightline.cache';

export function buildStatusKey(serviceDate: string, iataNumber: string): string {
  return `${CACHE_BASE}/status/v1/${serviceDate}/${iataNumber.toUpperCase()}`;
}

export function buildPositionKey(icao24OrCallsign: string): string {
  return `${CACHE_BASE}/position/v1/${icao24OrCallsign.toUpperCase()}`;
}

export function buildWeatherKey(icao: string): string {
  return `${CACHE_BASE}/weather/v1/${icao.toUpperCase()}`;
}

// Inbound rotation key, scoped by aircraft + target airport (or "ALL").
export function buildInboundKey(icao24: string, airportOrAll: string): string {
  return `${CACHE_BASE}/inbound/v1/${icao24.toLowerCase()}/${airportOrAll.toUpperCase()}`;
}

export function buildNasKey(iata: string): string {
  return `${CACHE_BASE}/nas/v1/${iata.toUpperCase()}`;
}

// --- Cache API wrapper ------------------------------------------------------

// Minimal shape of the Cloudflare Cache we depend on (injectable for tests).
export interface CacheLike {
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response): Promise<void>;
  delete(request: string): Promise<boolean>;
}

const CACHED_AT_HEADER = 'x-cached-at';
const LOGICAL_TTL_HEADER = 'x-logical-ttl';
const NEGATIVE_HEADER = 'x-negative';

export interface CachedRead<T> {
  data: T;
  cachedAtMs: number;
  ageSeconds: number;
  logicalTtl: number;
  fresh: boolean;
  negative: boolean;
}

// Read and interpret a cached entry. Returns null when nothing is stored.
export async function readCached<T>(
  cache: CacheLike,
  key: string,
  nowMs: number,
): Promise<CachedRead<T> | null> {
  const resp = await cache.match(key);
  if (!resp) return null;

  const cachedAtRaw = resp.headers.get(CACHED_AT_HEADER);
  const logicalTtlRaw = resp.headers.get(LOGICAL_TTL_HEADER);
  const cachedAtMs = cachedAtRaw ? Date.parse(cachedAtRaw) : NaN;
  const logicalTtl = logicalTtlRaw ? parseInt(logicalTtlRaw, 10) : 0;

  let data: T;
  try {
    data = (await resp.json()) as T;
  } catch {
    return null;
  }

  const ageSeconds = Number.isNaN(cachedAtMs) ? Infinity : (nowMs - cachedAtMs) / 1000;
  return {
    data,
    cachedAtMs: Number.isNaN(cachedAtMs) ? 0 : cachedAtMs,
    ageSeconds,
    logicalTtl,
    fresh: ageSeconds <= logicalTtl,
    negative: resp.headers.get(NEGATIVE_HEADER) === '1',
  };
}

// Store a JSON payload with freshness metadata. `physicalTtl` controls how long
// the edge physically retains the copy (>= logicalTtl to enable stale-if-error).
export async function writeCached<T>(
  cache: CacheLike,
  key: string,
  data: T,
  opts: { logicalTtl: number; physicalTtl: number; nowMs: number; negative?: boolean },
): Promise<void> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': `max-age=${opts.physicalTtl}`,
    [CACHED_AT_HEADER]: new Date(opts.nowMs).toISOString(),
    [LOGICAL_TTL_HEADER]: String(opts.logicalTtl),
  });
  if (opts.negative) headers.set(NEGATIVE_HEADER, '1');
  await cache.put(key, new Response(JSON.stringify(data), { headers }));
}

export async function deleteCached(cache: CacheLike, key: string): Promise<void> {
  try {
    await cache.delete(key);
  } catch {
    // best-effort
  }
}
