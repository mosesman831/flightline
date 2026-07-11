// Aviationstack provider
// API: http://api.aviationstack.com/v1/
// Endpoints: flights, schedules, airports, airlines
// Rate: 100 free/month
// Key: passed as query param ?access_key=KEY
// Returns: paginated JSON with data array
export async function fetchFromAviationstack(
  flightNumber: string,
  apiKey: string
): Promise<Partial<import('../types').NormalizedFlightStatus> | null> {
  // Fetch flight by IATA number
  const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${flightNumber}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = (await resp.json()) as any;
  if (!json.data || json.data.length === 0) return null;
  const f = json.data[0];
  return {
    flightNumber: f.flight?.iata || flightNumber,
    airlineIata: f.airline?.iata || '',
    airlineName: f.airline?.name || '',
    origin: { iata: f.departure?.iata || '', icao: f.departure?.icao || '', name: f.departure?.airport || '' },
    destination: { iata: f.arrival?.iata || '', icao: f.arrival?.icao || '', name: f.arrival?.airport || '' },
    scheduledDeparture: f.departure?.scheduled || null,
    scheduledArrival: f.arrival?.scheduled || null,
    estimatedDeparture: f.departure?.estimated || null,
    estimatedArrival: f.arrival?.estimated || null,
    actualDeparture: f.departure?.actual || null,
    actualArrival: f.arrival?.actual || null,
    status: f.flight_status || 'unknown',
    delayMinutes: f.departure?.delay || null,
    gate: f.departure?.gate || f.arrival?.gate || null,
    terminal: f.departure?.terminal || f.arrival?.terminal || null,
    aircraft: f.aircraft?.iata || null,
    tailNumber: f.aircraft?.registration || null,
    codeshare: f.flight?.codeshared?.flight_iata || null,
    dataSources: ['aviationstack'],
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchAirportDelays(
  iataCode: string,
  apiKey: string
): Promise<any> {
  // Aviationstack doesn't have a direct delays endpoint, return null
  return null;
}
