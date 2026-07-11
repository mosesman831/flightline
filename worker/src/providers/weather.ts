// Aviation weather adapter (aviationweather.gov) — free, no key. Returns
// normalized METAR + TAF only (no forecast). HTTPS.
import type { ProviderResult } from '../types';
import { numOrNull, statuteMilesToKm, observedAtFromEpoch } from '../normalize';
import { recordSuccess, recordError } from '../providerState';
import type { FetchImpl } from './aviationstack';

// The weather payload fields (envelope added by the router).
export interface WeatherCore {
  airport: string;
  metar: string | null;
  taf: string | null;
  windSpeedKts: number | null;
  windGustKts: number | null;
  visibilityKm: number | null;
  temperatureC: number | null;
  observedAt: string | null;
}

// Parse the leading numeric portion of an aviationweather visibility value
// (e.g. "10+" or 6). Returns statute miles or null.
function parseVisibMiles(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const m = raw.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  return null;
}

// PURE mapper: raw METAR record + raw TAF string -> WeatherCore.
export function mapWeather(icao: string, metar: any, taf: string | null, nowMs: number): WeatherCore {
  if (!metar || typeof metar !== 'object') {
    return {
      airport: icao,
      metar: null,
      taf: taf ?? null,
      windSpeedKts: null,
      windGustKts: null,
      visibilityKm: null,
      temperatureC: null,
      observedAt: null,
    };
  }
  return {
    airport: icao,
    metar: metar.rawOb ?? null,
    taf: taf ?? null,
    windSpeedKts: numOrNull(metar.wspd),
    windGustKts: numOrNull(metar.wgst),
    visibilityKm: statuteMilesToKm(parseVisibMiles(metar.visib)),
    temperatureC: numOrNull(metar.temp),
    observedAt: metar.obsTime != null ? observedAtFromEpoch(metar.obsTime, nowMs) : null,
  };
}

async function fetchJson(url: string, fetchImpl: FetchImpl): Promise<any> {
  const resp = await fetchImpl(url);
  if (!resp.ok) throw new Error(`upstream ${resp.status}`);
  return resp.json();
}

export async function fetchWeather(
  icao: string,
  fetchImpl: FetchImpl = fetch,
  nowMs: number = Date.now(),
): Promise<ProviderResult<WeatherCore>> {
  const code = icao.toUpperCase();
  const metarUrl = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(code)}&format=json`;
  const tafUrl = `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(code)}&format=json`;

  let metarJson: any;
  try {
    metarJson = await fetchJson(metarUrl, fetchImpl);
  } catch (err) {
    recordError('weather', err instanceof Error ? err.message : 'error', nowMs);
    return { ok: false, reason: 'error', message: 'metar fetch failed' };
  }

  let tafRaw: string | null = null;
  try {
    const tafJson = await fetchJson(tafUrl, fetchImpl);
    tafRaw = Array.isArray(tafJson) ? tafJson[0]?.rawTAF ?? null : null;
  } catch {
    // TAF is optional; keep METAR result.
    tafRaw = null;
  }

  const metar = Array.isArray(metarJson) ? metarJson[0] : null;
  if (!metar && !tafRaw) {
    recordSuccess('weather', nowMs);
    return { ok: false, reason: 'no_match' };
  }

  recordSuccess('weather', nowMs);
  return { ok: true, data: mapWeather(code, metar, tafRaw, nowMs) };
}
