// Fetches live precipitation radar metadata from the free RainViewer API and
// builds a MapLibre-compatible raster tile URL template for overlaying the most
// recent radar frame on the map. Dependency-free (uses the browser fetch API).

/** Attribution string to display for the radar overlay layer. */
export const RADAR_ATTRIBUTION = 'RainViewer';

/** Public RainViewer weather-maps endpoint (no API key required). */
const WEATHER_MAPS_URL = 'https://api.rainviewer.com/public/weather-maps.json';

/** A single radar frame descriptor returned by the RainViewer API. */
interface RadarFrame {
  time: number;
  path: string;
}

/** Shape of the relevant fields in the RainViewer weather-maps response. */
interface WeatherMapsResponse {
  host: string;
  radar: {
    past: RadarFrame[];
    nowcast: RadarFrame[];
  };
}

/**
 * Fetch the latest available radar frame and return a MapLibre raster tile URL
 * template with `{z}/{x}/{y}` placeholders.
 *
 * The most recent frame is the last entry of `radar.nowcast` when present,
 * otherwise the last entry of `radar.past`. Tiles are requested at 256px with
 * color scheme 4 and smooth + snow options enabled, producing:
 * `${host}${path}/256/{z}/{x}/{y}/4/1_1.png`.
 *
 * @returns The tile URL template, or `null` on any error or if no frame exists.
 */
export async function getRadarTileTemplate(): Promise<string | null> {
  try {
    const res = await fetch(WEATHER_MAPS_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as WeatherMapsResponse;
    const nowcast = data.radar?.nowcast ?? [];
    const past = data.radar?.past ?? [];
    const frame = nowcast.length > 0 ? nowcast[nowcast.length - 1] : past[past.length - 1];
    if (!frame) return null;
    return `${data.host}${frame.path}/256/{z}/{x}/{y}/4/1_1.png`;
  } catch {
    return null;
  }
}
