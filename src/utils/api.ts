// Typed client for the Flightline Cloudflare Worker.
// Dependency-free: relies only on the browser `fetch`, `navigator`, and
// `import.meta.env`. Mirrors the Worker JSON contract exactly.

/**
 * Resolve the Worker base URL.
 *
 * Uses `VITE_FLIGHTLINE_API_URL` when defined, otherwise falls back to the
 * local dev Worker at `http://localhost:8787`. Any trailing slash is trimmed
 * so callers can safely concatenate `/api/...` paths. Provider keys are
 * Worker-only now, so no localStorage is read here.
 */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_FLIGHTLINE_API_URL;
  const base = configured && configured.length > 0 ? configured : 'http://localhost:8787';
  return base.replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Types (mirror the Worker exactly)
// ---------------------------------------------------------------------------

/** An airport reference as returned by the Worker. */
export interface ApiAirport {
  iata: string;
  icao: string;
  name: string;
}

/** A live aircraft position sample. */
export interface ApiLivePosition {
  icao24: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  groundSpeedKt: number | null;
  heading: number | null;
  verticalRateFpm: number | null;
  onGround: boolean;
  observedAt: string;
  stale: boolean;
  source: 'adsb.lol' | 'opensky';
}

/** Canonical lifecycle status of a flight. */
export type ApiFlightStatus =
  | 'scheduled'
  | 'boarding'
  | 'active'
  | 'landed'
  | 'delayed'
  | 'cancelled'
  | 'diverted';

/** A fully normalized flight record returned by the Worker. */
export interface NormalizedFlight {
  requestId: string;
  fetchedAt: string;
  dataSources: string[];
  stale: boolean;
  canonicalKey: string;
  serviceDate: string;
  iataNumber: string;
  flightNumber: string;
  airlineIata: string;
  airlineName: string;
  origin: ApiAirport;
  destination: ApiAirport;
  scheduledDeparture: string | null;
  scheduledArrival: string | null;
  estimatedDeparture: string | null;
  estimatedArrival: string | null;
  actualDeparture: string | null;
  actualArrival: string | null;
  status: ApiFlightStatus;
  delayMinutes: number | null;
  gate: string | null;
  terminal: string | null;
  aircraft: string | null;
  registration: string | null;
  codeshare: string | null;
  statusSource: string | null;
  positionSource: string | null;
  livePosition: ApiLivePosition | null;
}

/** Weather observation for an airport. */
export interface ApiWeather {
  requestId: string;
  fetchedAt: string;
  dataSources: string[];
  stale: boolean;
  airport: string;
  metar: string | null;
  taf: string | null;
  windSpeedKts: number | null;
  windGustKts: number | null;
  visibilityKm: number | null;
  temperatureC: number | null;
  observedAt: string | null;
}

/** A prior leg (inbound rotation) of the aircraft operating this flight. */
export interface ApiInboundLeg {
  found: boolean;
  flightIata: string | null;
  originIcao: string | null;
  originIata: string | null;
  destinationIcao: string | null;
  scheduledArrival: string | null;
  arrivalEstimated: string | null;
  arrivalActual: string | null;
  icao24: string;
  tail: string | null;
  source: 'opensky';
}

/** A single FAA National Airspace System advisory affecting an airport. */
export interface ApiNasEvent {
  type: 'ground_stop' | 'ground_delay' | 'closure' | 'delay';
  reason: string | null;
  avgDelayMinutes: number | null;
  scope: string | null;
  endTime: string | null;
}

/** FAA NAS status for a US airport. */
export interface ApiNasStatus {
  requestId: string;
  fetchedAt: string;
  airport: string;
  hasIssues: boolean;
  events: ApiNasEvent[];
  source: 'faa';
}

/** Diagnostic report describing a single upstream data provider. */
export interface ProviderReport {
  name: string;
  key: string;
  configured: boolean;
  requiresKey: boolean;
  lastOutcome: 'ok' | 'error' | 'unknown';
  lastError: string | null;
  lastCheckedAt: string | null;
  data: string;
}

// ---------------------------------------------------------------------------
// Error model
// ---------------------------------------------------------------------------

/** Discriminated error codes surfaced by {@link trackFlight}. */
export type TrackErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'rate_limited'
  | 'providers_unavailable'
  | 'offline'
  | 'network';

/** Typed error thrown by {@link trackFlight}. */
export class TrackError extends Error {
  code: TrackErrorCode;
  constructor(code: TrackErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Shared fetch init: never serve from cache. */
const NO_STORE_INIT: RequestInit = { cache: 'no-store' };

/** Map an HTTP status to a {@link TrackErrorCode}, or null when unmapped. */
function statusToTrackCode(status: number): TrackErrorCode | null {
  switch (status) {
    case 400:
      return 'invalid_input';
    case 404:
      return 'not_found';
    case 429:
      return 'rate_limited';
    case 502:
    case 503:
      return 'providers_unavailable';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Track a flight by airline/number/date.
 *
 * POSTs to `/api/track`. Throws {@link TrackError} with `offline` when the
 * device is offline (before any fetch), `network` on transport failure, and a
 * status-mapped code (preferring the server-provided `code`) on non-2xx.
 */
export async function trackFlight(
  airlineIata: string,
  flightNumber: string,
  date: string,
): Promise<NormalizedFlight> {
  if (!navigator.onLine) {
    throw new TrackError('offline', 'You appear to be offline.');
  }

  const base = getApiBaseUrl();
  let resp: Response;
  try {
    resp = await fetch(`${base}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ airlineIata, flightNumber, date }),
      cache: 'no-store',
    });
  } catch {
    throw new TrackError('network', 'Network request failed.');
  }

  if (resp.ok) {
    return (await resp.json()) as NormalizedFlight;
  }

  // Attempt to read the structured error body: `{ error, code }`.
  let serverCode: TrackErrorCode | undefined;
  let serverError: string | undefined;
  try {
    const body = (await resp.json()) as { error?: string; code?: TrackErrorCode };
    serverCode = body?.code;
    serverError = body?.error;
  } catch {
    // Non-JSON error body; fall back to status mapping below.
  }

  const code = serverCode ?? statusToTrackCode(resp.status) ?? 'network';
  const message = serverError ?? `Request failed with status ${resp.status}.`;
  throw new TrackError(code, message);
}

/**
 * Fetch the latest snapshot for a flight (used by polling).
 *
 * GETs `/api/flight/:iataNumber?date=`. Fails soft: returns null on 404 or on
 * any network/parse error, and never throws.
 */
export async function fetchFlightSnapshot(
  iataNumber: string,
  date: string,
): Promise<NormalizedFlight | null> {
  const base = getApiBaseUrl();
  try {
    const resp = await fetch(
      `${base}/api/flight/${encodeURIComponent(iataNumber)}?date=${date}`,
      NO_STORE_INIT,
    );
    if (!resp.ok) return null;
    return (await resp.json()) as NormalizedFlight;
  } catch {
    return null;
  }
}

/**
 * Fetch a live position by ICAO24 hex address.
 *
 * GETs `/api/position/:icao24`. Returns null on 404 or any error.
 */
export async function fetchPositionByIcao(icao24: string): Promise<ApiLivePosition | null> {
  const base = getApiBaseUrl();
  try {
    const resp = await fetch(`${base}/api/position/${encodeURIComponent(icao24)}`, NO_STORE_INIT);
    if (!resp.ok) return null;
    return (await resp.json()) as ApiLivePosition;
  } catch {
    return null;
  }
}

/**
 * Fetch a live position by callsign.
 *
 * GETs `/api/position/callsign/:callsign`. Returns null on 404 or any error.
 */
export async function fetchPositionByCallsign(callsign: string): Promise<ApiLivePosition | null> {
  const base = getApiBaseUrl();
  try {
    const resp = await fetch(
      `${base}/api/position/callsign/${encodeURIComponent(callsign)}`,
      NO_STORE_INIT,
    );
    if (!resp.ok) return null;
    return (await resp.json()) as ApiLivePosition;
  } catch {
    return null;
  }
}

/**
 * Fetch weather for an airport by ICAO code.
 *
 * GETs `/api/weather/:icao`. Returns null on any error.
 */
export async function fetchWeather(icao: string): Promise<ApiWeather | null> {
  const base = getApiBaseUrl();
  try {
    const resp = await fetch(`${base}/api/weather/${encodeURIComponent(icao)}`, NO_STORE_INIT);
    if (!resp.ok) return null;
    return (await resp.json()) as ApiWeather;
  } catch {
    return null;
  }
}

/**
 * Fetch the provider diagnostics report.
 *
 * GETs `/api/providers`. Returns an empty array on any error.
 */
export async function fetchProviders(): Promise<ProviderReport[]> {
  const base = getApiBaseUrl();
  try {
    const resp = await fetch(`${base}/api/providers`, NO_STORE_INIT);
    if (!resp.ok) return [];
    return (await resp.json()) as ProviderReport[];
  } catch {
    return [];
  }
}

/**
 * Fetch the inbound rotation (prior leg) of the aircraft, by ICAO24.
 *
 * GETs `/api/inbound/:icao24?airport=ICAO&before=ISO`. Returns null on 404 or
 * any error (inbound tracking is best-effort / optional).
 */
export async function fetchInbound(
  icao24: string,
  airportIcao: string,
  beforeIso: string,
): Promise<ApiInboundLeg | null> {
  const base = getApiBaseUrl();
  try {
    const qs = `airport=${encodeURIComponent(airportIcao)}&before=${encodeURIComponent(beforeIso)}`;
    const resp = await fetch(`${base}/api/inbound/${encodeURIComponent(icao24)}?${qs}`, NO_STORE_INIT);
    if (!resp.ok) return null;
    return (await resp.json()) as ApiInboundLeg;
  } catch {
    return null;
  }
}

/**
 * Fetch FAA NAS status (ground stops / delays) for a US airport by IATA code.
 *
 * GETs `/api/nas/:iata`. Returns null on error or for non-US airports.
 */
export async function fetchNasStatus(iata: string): Promise<ApiNasStatus | null> {
  const base = getApiBaseUrl();
  try {
    const resp = await fetch(`${base}/api/nas/${encodeURIComponent(iata)}`, NO_STORE_INIT);
    if (!resp.ok) return null;
    return (await resp.json()) as ApiNasStatus;
  } catch {
    return null;
  }
}

/**
 * Probe Worker health.
 *
 * GETs `/api/health`. Returns true iff the response is ok, false on any error.
 */
export async function checkHealth(): Promise<boolean> {
  const base = getApiBaseUrl();
  try {
    const resp = await fetch(`${base}/api/health`, NO_STORE_INIT);
    return resp.ok;
  } catch {
    return false;
  }
}
