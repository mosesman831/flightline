// OpenSky Network — FREE, no key needed (rate limited ~10 req/5min)
// API: https://opensky-network.org/api/
// Endpoints: /flights/all, /flights/aircraft, /states/all, /flights/arrival, /flights/departure
export async function fetchFromOpenSky(
  icao24: string
): Promise<import('../types').LivePosition | null> {
  const url = `https://opensky-network.org/api/states/all?icao24=${icao24}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = (await resp.json()) as any;
  if (!json.states || json.states.length === 0) return null;
  const s = json.states[0];
  return {
    icao24: s[0] || icao24,
    callsign: (s[1] || '').trim(),
    originCountry: s[2] || '',
    latitude: s[6] || 0,
    longitude: s[5] || 0,
    altitude: s[7] || null,
    velocity: s[9] || null,
    heading: s[10] || null,
    verticalRate: s[11] || null,
    onGround: s[8] || false,
    lastContact: s[4] || 0,
  };
}
