// ADSB.lol provider — FREE, no key needed
// API: https://api.adsb.lol/v2/
// Endpoints: /icao24/{icao24}, /callsign/{callsign}, /adsbex/{icao24}
// Rate: dynamic, generous, community-supported
export async function fetchLivePosition(
  icao24: string
): Promise<import('../types').LivePosition | null> {
  const url = `https://api.adsb.lol/v2/icao24/${icao24}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = (await resp.json()) as any;
  const ac = json.ac?.[0];
  if (!ac) return null;
  return {
    icao24: ac.icao24 || icao24,
    callsign: ac.callsign?.trim() || '',
    originCountry: ac.origin_country || '',
    latitude: ac.lat || 0,
    longitude: ac.lon || 0,
    altitude: ac.alt_baro || null,
    velocity: ac.gs || null,
    heading: ac.track || null,
    verticalRate: ac.baro_rate || null,
    onGround: ac.alt_baro === 0 || false,
    lastContact: ac.seen || 0,
  };
}

export async function searchByCallsign(
  callsign: string
): Promise<import('../types').LivePosition | null> {
  const url = `https://api.adsb.lol/v2/callsign/${callsign}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = (await resp.json()) as any;
  const ac = json.ac?.[0];
  if (!ac) return null;
  return {
    icao24: ac.icao24 || '',
    callsign: ac.callsign?.trim() || '',
    originCountry: ac.origin_country || '',
    latitude: ac.lat || 0,
    longitude: ac.lon || 0,
    altitude: ac.alt_baro || null,
    velocity: ac.gs || null,
    heading: ac.track || null,
    verticalRate: ac.baro_rate || null,
    onGround: ac.alt_baro === 0 || false,
    lastContact: ac.seen || 0,
  };
}
