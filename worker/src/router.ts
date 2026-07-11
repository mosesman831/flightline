// Smart routing: picks the best provider for each data type
// Falls back gracefully on failure or missing keys
import type { ApiKeys, NormalizedFlightStatus, LivePosition, WeatherData } from './types';
import { getCached, setCache, TTL } from './cache';
import { fetchFromAviationstack } from './providers/aviationstack';
import { fetchFromAirlabs } from './providers/airlabs';
import { fetchLivePosition, searchByCallsign } from './providers/adsblol';
import { fetchFromOpenSky } from './providers/opensky';
import { fetchMetar, fetchTaf, fetchWeatherForecast } from './providers/weather';

// Merge two partial flight statuses, preferring non-null values
function mergeFlightData(
  primary: Partial<NormalizedFlightStatus>,
  secondary: Partial<NormalizedFlightStatus>
): NormalizedFlightStatus {
  const sources = new Set<string>([...(primary.dataSources || []), ...(secondary.dataSources || [])]);
  return {
    flightNumber: primary.flightNumber || secondary.flightNumber || '',
    airlineIata: primary.airlineIata || secondary.airlineIata || '',
    airlineName: primary.airlineName || secondary.airlineName || '',
    origin: primary.origin || secondary.origin || { iata: '', icao: '', name: '' },
    destination: primary.destination || secondary.destination || { iata: '', icao: '', name: '' },
    scheduledDeparture: primary.scheduledDeparture || secondary.scheduledDeparture || null,
    scheduledArrival: primary.scheduledArrival || secondary.scheduledArrival || null,
    estimatedDeparture: primary.estimatedDeparture || secondary.estimatedDeparture || null,
    estimatedArrival: primary.estimatedArrival || secondary.estimatedArrival || null,
    actualDeparture: primary.actualDeparture || secondary.actualDeparture || null,
    actualArrival: primary.actualArrival || secondary.actualArrival || null,
    status: primary.status || secondary.status || 'unknown',
    delayMinutes: primary.delayMinutes ?? secondary.delayMinutes ?? null,
    gate: primary.gate || secondary.gate || null,
    terminal: primary.terminal || secondary.terminal || null,
    aircraft: primary.aircraft || secondary.aircraft || null,
    tailNumber: primary.tailNumber || secondary.tailNumber || null,
    codeshare: primary.codeshare || secondary.codeshare || null,
    dataSources: [...sources],
    fetchedAt: new Date().toISOString(),
  };
}

export async function getFlightStatus(
  flightNumber: string,
  keys: ApiKeys
): Promise<NormalizedFlightStatus | null> {
  const cacheKey = `flight:${flightNumber.toUpperCase()}`;
  const cached = getCached<NormalizedFlightStatus>(cacheKey);
  if (cached) return cached;

  // Try providers in parallel, merge results
  const promises: Promise<Partial<NormalizedFlightStatus> | null>[] = [];
  
  if (keys.airlabs) {
    promises.push(fetchFromAirlabs(flightNumber, keys.airlabs).catch(() => null));
  }
  if (keys.aviationstack) {
    promises.push(fetchFromAviationstack(flightNumber, keys.aviationstack).catch(() => null));
  }

  const results = await Promise.allSettled(promises);
  const successful = results
    .filter((r): r is PromiseFulfilledResult<Partial<NormalizedFlightStatus>> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  if (successful.length === 0) return null;

  // Merge: airlabs first (more data), aviationstack second (gate/terminal)
  let merged: Partial<NormalizedFlightStatus> = successful[0];
  for (let i = 1; i < successful.length; i++) {
    merged = mergeFlightData(merged, successful[i]) as Partial<NormalizedFlightStatus>;
  }

  setCache(cacheKey, merged as NormalizedFlightStatus, TTL.FLIGHT_STATUS);
  return merged as NormalizedFlightStatus;
}

export async function getLivePosition(
  icao24: string
): Promise<LivePosition | null> {
  const cacheKey = `pos:${icao24}`;
  const cached = getCached<LivePosition>(cacheKey);
  if (cached) return cached;

  // Try ADSB.lol first (faster, community-maintained)
  let pos = await fetchLivePosition(icao24).catch(() => null);
  
  // Fallback to OpenSky
  if (!pos) {
    pos = await fetchFromOpenSky(icao24).catch(() => null);
  }

  if (pos) {
    setCache(cacheKey, pos, TTL.LIVE_POSITION);
  }
  return pos;
}

export async function getAirportWeather(
  airportIcao: string
): Promise<WeatherData> {
  const cacheKey = `weather:${airportIcao}`;
  const cached = getCached<WeatherData>(cacheKey);
  if (cached) return cached;

  const weather = await fetchMetar(airportIcao);
  const taf = await fetchTaf(airportIcao);
  weather.taf = taf;

  setCache(cacheKey, weather, TTL.WEATHER);
  return weather;
}

export function getProviderStatus(keys: ApiKeys) {
  return [
    {
      name: 'Aviationstack',
      enabled: !!keys.aviationstack,
      healthy: true,
      requestsUsed: 0, // Would need KV tracking
      requestsLimit: 100,
      lastError: null,
      lastChecked: new Date().toISOString(),
      data: 'Gates, terminals, airline codes, flight schedules',
    },
    {
      name: 'AirLabs',
      enabled: !!keys.airlabs,
      healthy: true,
      requestsUsed: 0,
      requestsLimit: 1000,
      lastError: null,
      lastChecked: new Date().toISOString(),
      data: 'Flight status, airports, airlines, fleet, schedules',
    },
    {
      name: 'ADSB.lol',
      enabled: true,
      healthy: true,
      requestsUsed: 0,
      requestsLimit: -1, // unlimited
      lastError: null,
      lastChecked: new Date().toISOString(),
      data: 'Live ADS-B position, aircraft tracking, routes',
    },
    {
      name: 'OpenSky Network',
      enabled: true,
      healthy: true,
      requestsUsed: 0,
      requestsLimit: -1,
      lastError: null,
      lastChecked: new Date().toISOString(),
      data: 'Live ADS-B position (fallback)',
    },
    {
      name: 'Aviation Weather',
      enabled: true,
      healthy: true,
      requestsUsed: 0,
      requestsLimit: -1,
      lastError: null,
      lastChecked: new Date().toISOString(),
      data: 'METAR, TAF, NOTAMs, SIGMETs',
    },
    {
      name: 'Open-Meteo',
      enabled: true,
      healthy: true,
      requestsUsed: 0,
      requestsLimit: -1,
      lastError: null,
      lastChecked: new Date().toISOString(),
      data: 'General weather, forecasts, UV index',
    },
  ];
}
