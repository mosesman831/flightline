import type { Flight, Airport, WeatherForecast } from '../types/flight';

const WORKER_URL_KEY = 'flightline-worker-url';

function getWorkerUrl(): string {
  return localStorage.getItem(WORKER_URL_KEY) || 'http://localhost:8787';
}

// Fetch live status for a flight from the worker
export async function fetchFlightStatus(flightNumber: string): Promise<Record<string, any> | null> {
  try {
    const resp = await fetch(`${getWorkerUrl()}/api/flight/${flightNumber}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// Fetch live ADS-B position for an aircraft
export async function fetchLivePosition(icao24: string): Promise<Record<string, any> | null> {
  try {
    const resp = await fetch(`${getWorkerUrl()}/api/position/${icao24}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// Fetch airport weather (METAR/TAF)
export async function fetchAirportWeather(icao: string): Promise<Record<string, any> | null> {
  try {
    const resp = await fetch(`${getWorkerUrl()}/api/weather/${icao}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// Check worker health
export async function checkWorkerHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${getWorkerUrl()}/api/health`);
    return resp.ok;
  } catch {
    return false;
  }
}

// Get provider status
export async function getProviderStatus(): Promise<any[]> {
  try {
    const resp = await fetch(`${getWorkerUrl()}/api/providers`);
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

// Merge live data into existing flight object
export async function enrichFlightWithLiveData(flight: Flight): Promise<Flight> {
  const enriched = { ...flight };

  try {
    // 1. Get live flight status from worker
    const status = await fetchFlightStatus(flight.flightNumber);
    if (status) {
      enriched.gate = status.gate || enriched.gate;
      enriched.terminal = status.terminal || enriched.terminal;
      enriched.aircraft = status.aircraft || enriched.aircraft;
      enriched.tailNumber = status.tailNumber || enriched.tailNumber;
      enriched.delayMinutes = status.delayMinutes ?? enriched.delayMinutes;

      if (status.status) {
        const statusMap: Record<string, Flight['status']> = {
          'scheduled': 'scheduled',
          'active': 'active',
          'landed': 'landed',
          'cancelled': 'cancelled',
          'diverted': 'diverted',
          'delayed': 'delayed',
          'boarding': 'boarding',
        };
        enriched.status = statusMap[status.status] || enriched.status;
      }

      if (status.estimatedDeparture) enriched.predictedDeparture = status.estimatedDeparture;
      if (status.estimatedArrival) enriched.predictedArrival = status.estimatedArrival;
      if (status.actualDeparture) enriched.actualDeparture = status.actualDeparture;
      if (status.actualArrival) enriched.actualArrival = status.actualArrival;

      enriched.lastUpdatedAt = new Date().toISOString();
    }

    // 2. Get weather for origin and destination
    if (flight.origin?.icao) {
      const depWeather = await fetchAirportWeather(flight.origin.icao);
      if (depWeather?.metar) {
        enriched.pilotData = {
          metar: depWeather.metar,
          taf: depWeather.taf,
          windSpeedKts: depWeather.windSpeed,
          windGustKts: depWeather.windGust,
          visibilityKm: depWeather.visibility,
          temperature: depWeather.temperature,
        };
      }
    }
  } catch {
    // Silently fail — use cached data
  }

  return enriched;
}

// Batch refresh multiple flights
export async function batchRefreshFlights(flights: Flight[]): Promise<Flight[]> {
  const results = await Promise.allSettled(
    flights.map(f => enrichFlightWithLiveData(f))
  );
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : flights[i]
  );
}
