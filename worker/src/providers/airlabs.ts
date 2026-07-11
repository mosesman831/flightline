// AirLabs provider
// API: https://airlabs.co/api/v9/
// Endpoints: flight, flights, airports, airlines, fleet, schedules
// Rate: 1000 free/month
// Key: passed as ?api_key=KEY
export async function fetchFromAirlabs(
  flightNumber: string,
  apiKey: string
): Promise<Partial<import('../types').NormalizedFlightStatus> | null> {
  const url = `https://airlabs.co/api/v9/flight?api_key=${apiKey}&flight_iata=${flightNumber}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = (await resp.json()) as any;
  if (!json.response) return null;
  const f = json.response;
  return {
    flightNumber: f.flight_iata || flightNumber,
    airlineIata: f.airline_iata || '',
    airlineName: f.airline_name || f.airline_iata || '',
    origin: { iata: f.dep_iata || '', icao: f.dep_icao || '', name: f.dep_name || '' },
    destination: { iata: f.arr_iata || '', icao: f.arr_icao || '', name: f.arr_name || '' },
    scheduledDeparture: f.dep_time ? `${f.dep_time}` : null,
    scheduledArrival: f.arr_time ? `${f.arr_time}` : null,
    estimatedDeparture: f.dep_estimated || null,
    estimatedArrival: f.arr_estimated || null,
    actualDeparture: f.dep_actual || null,
    actualArrival: f.arr_actual || null,
    status: f.status || 'unknown',
    delayMinutes: f.dep_delayed || null,
    gate: f.dep_gate || f.arr_gate || null,
    terminal: f.dep_terminal || f.arr_terminal || null,
    aircraft: f.aircraft_iata || null,
    tailNumber: f.registration || null,
    codeshare: null,
    dataSources: ['airlabs'],
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchFlightSchedules(
  airlineIata: string,
  airportIata: string,
  apiKey: string
): Promise<any> {
  const url = `https://airlabs.co/api/v9/schedules?api_key=${apiKey}&airline_iata=${airlineIata}&dep_iata=${airportIata}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = (await resp.json()) as any;
  return json.response || null;
}
