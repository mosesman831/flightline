// Route matching + handlers. Handlers are pure with respect to injected deps
// (cache + provider fns) so the whole request pipeline is import-testable.
import type {
  Env,
  InboundLegCore,
  InboundResponse,
  LivePosition,
  NasStatusCore,
  NasStatusResponse,
  NormalizedFlight,
  WeatherData,
} from './types';
import {
  validateTrackInput,
  validateIataNumber,
  isHex24,
  isIcaoAirport,
} from './normalize';
import {
  type CacheLike,
  buildStatusKey,
  buildPositionKey,
  buildWeatherKey,
  buildInboundKey,
  buildNasKey,
  readCached,
  writeCached,
  statusTtlSeconds,
  STATUS_PHYSICAL_TTL_SECONDS,
  STATUS_STALE_MAX_MS,
  POSITION_TTL_SECONDS,
  WEATHER_TTL_SECONDS,
  NOT_FOUND_TTL_SECONDS,
  INBOUND_TTL_SECONDS,
  INBOUND_NOT_FOUND_TTL_SECONDS,
  NAS_TTL_SECONDS,
} from './cache';
import { getFlightSnapshot, type FlightServiceDeps } from './flightService';
import { buildProviderReports } from './providerState';
import type { ProviderResult } from './types';
import type { WeatherCore } from './providers/weather';

export const VERSION = '1.0.0';

export interface AppDeps {
  cache: CacheLike;
  now: () => number;
  requestId: () => string;
  flight: FlightServiceDeps;
  weather: (icao: string) => Promise<ProviderResult<WeatherCore>>;
  inbound: (
    icao24: string,
    airportIcao: string | null,
    beforeMs: number,
  ) => Promise<ProviderResult<InboundLegCore>>;
  nas: (iata: string) => Promise<ProviderResult<NasStatusCore>>;
}

export interface RouteResult {
  status: number;
  body: unknown;
}

interface ErrorBody {
  error: string;
  code: string;
}

function errorBody(error: string, code: string): ErrorBody {
  return { error, code };
}

// A live-position response envelope (adds the shared response metadata).
interface PositionResponse {
  requestId: string;
  fetchedAt: string;
  dataSources: string[];
  stale: boolean;
  position: LivePosition;
}

function positionResponse(position: LivePosition, deps: AppDeps, now: number): PositionResponse {
  return {
    requestId: deps.requestId(),
    fetchedAt: new Date(now).toISOString(),
    dataSources: [position.source],
    stale: position.stale,
    position,
  };
}

// --- Status endpoints (/api/track, /api/flight) -----------------------------

async function serveStatus(
  deps: AppDeps,
  iataNumber: string,
  serviceDate: string,
): Promise<RouteResult> {
  const now = deps.now();
  const key = buildStatusKey(serviceDate, iataNumber);

  const cached = await readCached<NormalizedFlight | ErrorBody>(deps.cache, key, now);
  if (cached && cached.fresh) {
    if (cached.negative) {
      return { status: 404, body: cached.data as ErrorBody };
    }
    return { status: 200, body: { ...(cached.data as NormalizedFlight), stale: false } };
  }

  const result = await getFlightSnapshot(iataNumber, serviceDate, deps.flight);

  if (result.ok) {
    const ttl = statusTtlSeconds(result.flight.status, result.flight.scheduledDeparture, now);
    await writeCached(deps.cache, key, result.flight, {
      logicalTtl: ttl,
      physicalTtl: STATUS_PHYSICAL_TTL_SECONDS,
      nowMs: now,
    });
    return { status: 200, body: result.flight };
  }

  // Confirmed not-found: negative-cache briefly.
  if (result.code === 'not_found') {
    const body = errorBody(result.error, result.code);
    await writeCached(deps.cache, key, body, {
      logicalTtl: NOT_FOUND_TTL_SECONDS,
      physicalTtl: NOT_FOUND_TTL_SECONDS,
      nowMs: now,
      negative: true,
    });
    return { status: 404, body };
  }

  // Upstream/auth/rate-limit failure: serve the last successful copy as stale
  // (stale-if-error) if still within the 15-minute window. Never negative-cache.
  if (cached && !cached.negative && now - cached.cachedAtMs <= STATUS_STALE_MAX_MS) {
    return { status: 200, body: { ...(cached.data as NormalizedFlight), stale: true } };
  }

  return { status: result.httpStatus, body: errorBody(result.error, result.code) };
}

// --- Position endpoints -----------------------------------------------------

async function servePosition(
  deps: AppDeps,
  cacheId: string,
  produce: () => Promise<{ ok: true; position: LivePosition } | { ok: false; confirmed: boolean }>,
): Promise<RouteResult> {
  const now = deps.now();
  const key = buildPositionKey(cacheId);

  const cached = await readCached<PositionResponse | ErrorBody>(deps.cache, key, now);
  if (cached && cached.fresh) {
    if (cached.negative) return { status: 404, body: cached.data as ErrorBody };
    return { status: 200, body: cached.data as PositionResponse };
  }

  const result = await produce();
  if (result.ok) {
    const body = positionResponse(result.position, deps, now);
    await writeCached(deps.cache, key, body, {
      logicalTtl: POSITION_TTL_SECONDS,
      physicalTtl: POSITION_TTL_SECONDS,
      nowMs: now,
    });
    return { status: 200, body };
  }

  const body = errorBody('No recent position found', 'not_found');
  if (result.confirmed) {
    await writeCached(deps.cache, key, body, {
      logicalTtl: NOT_FOUND_TTL_SECONDS,
      physicalTtl: NOT_FOUND_TTL_SECONDS,
      nowMs: now,
      negative: true,
    });
  }
  return { status: 404, body };
}

// definitively-absent iff both attempts responded with no_match/unusable.
function isConfirmedAbsent(...results: (ProviderResult<unknown> | null)[]): boolean {
  const relevant = results.filter((r): r is ProviderResult<unknown> => r !== null && !r.ok);
  if (relevant.length === 0) return false;
  return relevant.every((r) => !r.ok && (r.reason === 'no_match' || r.reason === 'unusable'));
}

async function positionByIcao24(deps: AppDeps, icao24: string): Promise<RouteResult> {
  return servePosition(deps, icao24, async () => {
    const adsb = await deps.flight.fetchAdsbPosition(icao24);
    if (adsb.ok) return { ok: true, position: adsb.data };
    const os = await deps.flight.fetchOpenSky(icao24);
    if (os.ok) return { ok: true, position: os.data };
    return { ok: false, confirmed: isConfirmedAbsent(adsb, os) };
  });
}

async function positionByCallsign(deps: AppDeps, callsign: string): Promise<RouteResult> {
  return servePosition(deps, callsign, async () => {
    const r = await deps.flight.searchAdsbCallsign(callsign);
    if (r.position.ok) return { ok: true, position: r.position.data };
    if (r.icao24) {
      const os = await deps.flight.fetchOpenSky(r.icao24);
      if (os.ok) return { ok: true, position: os.data };
      return { ok: false, confirmed: isConfirmedAbsent(r.position, os) };
    }
    return { ok: false, confirmed: isConfirmedAbsent(r.position) };
  });
}

// --- Weather endpoint -------------------------------------------------------

async function serveWeather(deps: AppDeps, icao: string): Promise<RouteResult> {
  const now = deps.now();
  const key = buildWeatherKey(icao);

  const cached = await readCached<WeatherData | ErrorBody>(deps.cache, key, now);
  if (cached && cached.fresh) {
    if (cached.negative) return { status: 404, body: cached.data as ErrorBody };
    return { status: 200, body: { ...(cached.data as WeatherData), stale: false } };
  }

  const result = await deps.weather(icao);
  if (result.ok) {
    const body: WeatherData = {
      requestId: deps.requestId(),
      fetchedAt: new Date(now).toISOString(),
      dataSources: ['weather'],
      stale: false,
      ...result.data,
    };
    await writeCached(deps.cache, key, body, {
      logicalTtl: WEATHER_TTL_SECONDS,
      physicalTtl: WEATHER_TTL_SECONDS,
      nowMs: now,
    });
    return { status: 200, body };
  }

  if (result.reason === 'no_match') {
    const body = errorBody('No weather for that airport', 'not_found');
    await writeCached(deps.cache, key, body, {
      logicalTtl: NOT_FOUND_TTL_SECONDS,
      physicalTtl: NOT_FOUND_TTL_SECONDS,
      nowMs: now,
      negative: true,
    });
    return { status: 404, body };
  }

  if (cached && !cached.negative) {
    return { status: 200, body: { ...(cached.data as WeatherData), stale: true } };
  }
  return { status: 502, body: errorBody('Weather provider unavailable', 'providers_unavailable') };
}

// --- Inbound rotation endpoint ----------------------------------------------

async function serveInbound(
  deps: AppDeps,
  icao24: string,
  airportIcao: string | null,
  beforeMs: number,
): Promise<RouteResult> {
  const now = deps.now();
  const key = buildInboundKey(icao24, airportIcao ?? 'ALL');

  const cached = await readCached<InboundResponse | ErrorBody>(deps.cache, key, now);
  if (cached && cached.fresh) {
    if (cached.negative) return { status: 404, body: cached.data as ErrorBody };
    return { status: 200, body: { ...(cached.data as InboundResponse), stale: false } };
  }

  const result = await deps.inbound(icao24, airportIcao, beforeMs);
  if (result.ok) {
    const body: InboundResponse = {
      requestId: deps.requestId(),
      fetchedAt: new Date(now).toISOString(),
      dataSources: ['opensky'],
      stale: false,
      found: true,
      ...result.data,
    };
    await writeCached(deps.cache, key, body, {
      logicalTtl: INBOUND_TTL_SECONDS,
      physicalTtl: INBOUND_TTL_SECONDS,
      nowMs: now,
    });
    return { status: 200, body };
  }

  // Empty/none from OpenSky: confirmed not-found -> negative-cache briefly.
  if (result.reason === 'no_match') {
    const body = errorBody('No inbound leg found for that aircraft', 'not_found');
    await writeCached(deps.cache, key, body, {
      logicalTtl: INBOUND_NOT_FOUND_TTL_SECONDS,
      physicalTtl: INBOUND_NOT_FOUND_TTL_SECONDS,
      nowMs: now,
      negative: true,
    });
    return { status: 404, body };
  }

  // Upstream failures are never negative-cached.
  if (result.reason === 'rate_limited') {
    return { status: 429, body: errorBody('OpenSky is rate-limited', 'rate_limited') };
  }
  return { status: 502, body: errorBody('OpenSky is unavailable', 'providers_unavailable') };
}

// --- NAS status endpoint ----------------------------------------------------

async function serveNas(deps: AppDeps, iata: string): Promise<RouteResult> {
  const now = deps.now();
  const key = buildNasKey(iata);

  const cached = await readCached<NasStatusResponse>(deps.cache, key, now);
  if (cached && cached.fresh && !cached.negative) {
    return { status: 200, body: { ...(cached.data as NasStatusResponse), stale: false } };
  }

  const result = await deps.nas(iata);
  if (result.ok) {
    const body: NasStatusResponse = {
      requestId: deps.requestId(),
      fetchedAt: new Date(now).toISOString(),
      dataSources: ['faa'],
      stale: false,
      source: 'faa',
      ...result.data,
    };
    await writeCached(deps.cache, key, body, {
      logicalTtl: NAS_TTL_SECONDS,
      physicalTtl: NAS_TTL_SECONDS,
      nowMs: now,
    });
    return { status: 200, body };
  }

  if (result.reason === 'rate_limited') {
    return { status: 429, body: errorBody('FAA NAS status is rate-limited', 'rate_limited') };
  }

  // Upstream unreachable: prefer graceful degradation by serving the last good
  // copy as stale; otherwise surface 502.
  if (cached && !cached.negative) {
    return { status: 200, body: { ...(cached.data as NasStatusResponse), stale: true } };
  }
  return { status: 502, body: errorBody('FAA NAS status is unavailable', 'providers_unavailable') };
}

// --- Router -----------------------------------------------------------------

export async function route(request: Request, env: Env, deps: AppDeps): Promise<RouteResult> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // POST /api/track
  if (path === '/api/track') {
    if (method !== 'POST') return { status: 405, body: errorBody('Method not allowed', 'invalid_input') };
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return { status: 400, body: errorBody('Request body must be valid JSON', 'invalid_input') };
    }
    const parsed = validateTrackInput(body);
    if (!parsed.ok) return { status: 400, body: errorBody(parsed.message, 'invalid_input') };
    return serveStatus(deps, parsed.value.iataNumber, parsed.value.date);
  }

  // GET /api/flight/:iataNumber?date=YYYY-MM-DD
  const flightMatch = path.match(/^\/api\/flight\/([^/]+)$/);
  if (flightMatch) {
    if (method !== 'GET') return { status: 405, body: errorBody('Method not allowed', 'invalid_input') };
    const parsed = validateIataNumber(decodeURIComponent(flightMatch[1]));
    if (!parsed.ok) return { status: 400, body: errorBody(parsed.message, 'invalid_input') };
    const date = url.searchParams.get('date');
    if (!date) return { status: 400, body: errorBody('date query parameter is required', 'invalid_input') };
    const dateCheck = validateTrackInput({ airlineIata: 'XX', flightNumber: '1', date });
    if (!dateCheck.ok) return { status: 400, body: errorBody('date must be a valid YYYY-MM-DD date', 'invalid_input') };
    return serveStatus(deps, parsed.value, date);
  }

  // GET /api/position/callsign/:callsign (check before /:icao24)
  const callsignMatch = path.match(/^\/api\/position\/callsign\/([^/]+)$/);
  if (callsignMatch) {
    if (method !== 'GET') return { status: 405, body: errorBody('Method not allowed', 'invalid_input') };
    const callsign = decodeURIComponent(callsignMatch[1]).trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(callsign)) {
      return { status: 400, body: errorBody('Invalid callsign', 'invalid_input') };
    }
    return positionByCallsign(deps, callsign);
  }

  // GET /api/position/:icao24
  const posMatch = path.match(/^\/api\/position\/([^/]+)$/);
  if (posMatch) {
    if (method !== 'GET') return { status: 405, body: errorBody('Method not allowed', 'invalid_input') };
    const icao24 = decodeURIComponent(posMatch[1]);
    if (!isHex24(icao24)) return { status: 400, body: errorBody('icao24 must be a 6-character hex string', 'invalid_input') };
    return positionByIcao24(deps, icao24.toLowerCase());
  }

  // GET /api/weather/:icao
  const weatherMatch = path.match(/^\/api\/weather\/([^/]+)$/);
  if (weatherMatch) {
    if (method !== 'GET') return { status: 405, body: errorBody('Method not allowed', 'invalid_input') };
    const icao = decodeURIComponent(weatherMatch[1]);
    if (!isIcaoAirport(icao)) return { status: 400, body: errorBody('icao must be a 4-letter airport code', 'invalid_input') };
    return serveWeather(deps, icao.toUpperCase());
  }

  // GET /api/inbound/:icao24?airport=ICAO&before=ISO
  const inboundMatch = path.match(/^\/api\/inbound\/([^/]+)$/);
  if (inboundMatch) {
    if (method !== 'GET') return { status: 405, body: errorBody('Method not allowed', 'invalid_input') };
    const icao24 = decodeURIComponent(inboundMatch[1]);
    if (!isHex24(icao24)) {
      return { status: 400, body: errorBody('icao24 must be a 6-character hex string', 'invalid_input') };
    }
    const before = url.searchParams.get('before');
    if (!before) {
      return { status: 400, body: errorBody('before query parameter is required', 'invalid_input') };
    }
    const beforeMs = Date.parse(before);
    if (Number.isNaN(beforeMs)) {
      return { status: 400, body: errorBody('before must be a valid ISO 8601 datetime', 'invalid_input') };
    }
    const airportRaw = url.searchParams.get('airport');
    const airportIcao = airportRaw && airportRaw.trim() ? airportRaw.trim().toUpperCase() : null;
    return serveInbound(deps, icao24.toLowerCase(), airportIcao, beforeMs);
  }

  // GET /api/nas/:iata
  const nasMatch = path.match(/^\/api\/nas\/([^/]+)$/);
  if (nasMatch) {
    if (method !== 'GET') return { status: 405, body: errorBody('Method not allowed', 'invalid_input') };
    const iata = decodeURIComponent(nasMatch[1]).trim();
    if (!/^[A-Za-z]{3}$/.test(iata)) {
      return { status: 400, body: errorBody('iata must be a 3-letter airport code', 'invalid_input') };
    }
    return serveNas(deps, iata.toUpperCase());
  }

  // GET /api/providers
  if (path === '/api/providers') {
    return { status: 200, body: buildProviderReports(env) };
  }

  // GET /api/health
  if (path === '/api/health') {
    return {
      status: 200,
      body: { status: 'ok', version: VERSION, timestamp: new Date(deps.now()).toISOString() },
    };
  }

  return { status: 404, body: errorBody('Not found', 'not_found') };
}
