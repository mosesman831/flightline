// Shared types for the Flightline Worker (Days 1-3 sprint contract)

// Worker environment bindings.
// Secrets: AVIATIONSTACK_API_KEY, AIRLABS_API_KEY
// Vars: PAGES_ORIGIN, DEV_ORIGIN (local only), ENVIRONMENT
export interface Env {
  AVIATIONSTACK_API_KEY?: string;
  AIRLABS_API_KEY?: string;
  PAGES_ORIGIN?: string;
  DEV_ORIGIN?: string;
  ENVIRONMENT?: string;
}

export interface ApiKeys {
  aviationstack?: string;
  airlabs?: string;
}

// Normalized flight status union shared with the frontend.
export type FlightStatus =
  | 'scheduled'
  | 'boarding'
  | 'active'
  | 'landed'
  | 'delayed'
  | 'cancelled'
  | 'diverted';

export interface NormalizedAirport {
  iata: string;
  icao: string;
  name: string;
}

// A normalized live ADS-B position. Units are normalized:
//   altitudeFt (feet), groundSpeedKt (knots), verticalRateFpm (feet/min).
export interface LivePosition {
  icao24: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  groundSpeedKt: number | null;
  heading: number | null;
  verticalRateFpm: number | null;
  onGround: boolean;
  observedAt: string; // absolute ISO 8601
  stale: boolean; // true when the observation is older than 60s
  source: 'adsb.lol' | 'opensky';
}

// The schedule/status base a schedule provider produces (pre-envelope).
export interface FlightBase {
  iataNumber: string;
  flightNumber: string;
  airlineIata: string;
  airlineName: string;
  flightIcao: string | null; // operational callsign candidate, e.g. BAW178
  origin: NormalizedAirport;
  destination: NormalizedAirport;
  scheduledDeparture: string | null;
  scheduledArrival: string | null;
  estimatedDeparture: string | null;
  estimatedArrival: string | null;
  actualDeparture: string | null;
  actualArrival: string | null;
  localDepartureDate: string | null; // YYYY-MM-DD in the origin's local time
  status: FlightStatus;
  delayMinutes: number | null;
  gate: string | null;
  terminal: string | null;
  aircraft: string | null;
  registration: string | null;
  icao24: string | null;
  codeshare: string | null;
  statusSource: string;
}

// The full normalized flight snapshot returned by /api/track and /api/flight.
export interface NormalizedFlight {
  requestId: string;
  fetchedAt: string;
  dataSources: string[];
  stale: boolean;
  canonicalKey: string; // YYYY-MM-DD:IATA_NUMBER
  serviceDate: string; // YYYY-MM-DD
  iataNumber: string; // BA178
  flightNumber: string; // 178
  airlineIata: string;
  airlineName: string;
  origin: NormalizedAirport;
  destination: NormalizedAirport;
  scheduledDeparture: string | null;
  scheduledArrival: string | null;
  estimatedDeparture: string | null;
  estimatedArrival: string | null;
  actualDeparture: string | null;
  actualArrival: string | null;
  status: FlightStatus;
  delayMinutes: number | null;
  gate: string | null;
  terminal: string | null;
  aircraft: string | null;
  registration: string | null;
  codeshare: string | null;
  statusSource: string | null;
  positionSource: string | null;
  livePosition: LivePosition | null;
}

// Normalized METAR/TAF weather.
export interface WeatherData {
  requestId: string;
  fetchedAt: string;
  dataSources: string[];
  stale: boolean;
  airport: string; // ICAO
  metar: string | null;
  taf: string | null;
  windSpeedKts: number | null;
  windGustKts: number | null;
  visibilityKm: number | null;
  temperatureC: number | null;
  observedAt: string | null;
}

// Provider readiness reporting for /api/providers.
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

// Discriminated result returned by every provider adapter so the fallback
// chain can reason deterministically about why a provider did not produce data.
export type ProviderFailureReason =
  | 'unconfigured'
  | 'no_match'
  | 'rate_limited'
  | 'auth'
  | 'unusable'
  | 'error';

export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ProviderFailureReason; message?: string };
