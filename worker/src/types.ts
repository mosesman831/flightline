// API keys config
export interface ApiKeys {
  aviationstack?: string;
  airlabs?: string;
  flightapi?: string;
}

// Normalized flight status from any provider
export interface NormalizedFlightStatus {
  flightNumber: string;
  airlineIata: string;
  airlineName: string;
  origin: { iata: string; icao: string; name: string };
  destination: { iata: string; icao: string; name: string };
  scheduledDeparture: string | null;
  scheduledArrival: string | null;
  estimatedDeparture: string | null;
  estimatedArrival: string | null;
  actualDeparture: string | null;
  actualArrival: string | null;
  status: string;
  delayMinutes: number | null;
  gate: string | null;
  terminal: string | null;
  aircraft: string | null;
  tailNumber: string | null;
  codeshare: string | null;
  dataSources: string[]; // which providers contributed
  fetchedAt: string;
}

// Live ADS-B position
export interface LivePosition {
  icao24: string;
  callsign: string;
  originCountry: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  verticalRate: number | null;
  onGround: boolean;
  lastContact: number;
}

// Weather observation
export interface WeatherData {
  airport: string;
  metar: string | null;
  taf: string | null;
  windSpeed: number | null;
  windGust: number | null;
  visibility: number | null;
  temperature: number | null;
  condition: string;
  fetchedAt: string;
}

// Provider health status
export interface ProviderStatus {
  name: string;
  enabled: boolean;
  healthy: boolean;
  requestsUsed: number;
  requestsLimit: number;
  lastError: string | null;
  lastChecked: string;
}

// Cache entry wrapper
export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}
