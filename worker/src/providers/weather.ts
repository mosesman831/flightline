// Weather providers — both FREE, no key needed
// aviationweather.gov: METAR, TAF, NOTAMs
// Open-Meteo: general weather forecasts

export async function fetchMetar(airportIcao: string): Promise<import('../types').WeatherData> {
  const url = `https://aviationweather.gov/api/data/metar?ids=${airportIcao}&format=json`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return emptyWeather(airportIcao);
    const json = (await resp.json()) as any;
    const metar = json[0];
    if (!metar) return emptyWeather(airportIcao);
    return {
      airport: airportIcao,
      metar: metar.rawOb || null,
      taf: null,
      windSpeed: metar.wspd || null,
      windGust: metar.wgst || null,
      visibility: metar.visib || null,
      temperature: metar.temp || null,
      condition: metar.wxString || 'CLR',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return emptyWeather(airportIcao);
  }
}

export async function fetchTaf(airportIcao: string): Promise<string | null> {
  const url = `https://aviationweather.gov/api/data/taf?ids=${airportIcao}&format=json`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json = (await resp.json()) as any;
    return json[0]?.rawTAF || null;
  } catch {
    return null;
  }
}

export async function fetchWeatherForecast(
  lat: number,
  lon: number
): Promise<any> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&timezone=auto&forecast_days=3`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function emptyWeather(airport: string): import('../types').WeatherData {
  return {
    airport,
    metar: null,
    taf: null,
    windSpeed: null,
    windGust: null,
    visibility: null,
    temperature: null,
    condition: 'Unknown',
    fetchedAt: new Date().toISOString(),
  };
}
