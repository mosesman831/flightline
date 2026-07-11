import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Globe,
  AirplaneTilt,
  MapPin,
  Path,
  Buildings,
  Airplane,
  Target,
} from '@phosphor-icons/react';
import type { Flight } from '../types/flight';
import { interpolateGreatCircle } from '../utils/geo';
import { computeStats } from '../utils/stats';

/** A single flight's origin/destination coordinate pair. */
interface RouteCoords {
  origin: [number, number];
  destination: [number, number];
}

/** True when a coordinate pair is the null island (0,0) or non-finite. */
function isMissingCoord(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return true;
  return lat === 0 && lon === 0;
}

/** Build a curved great-circle line (as [lon,lat] pairs) between two points. */
function buildArc(o: [number, number], d: [number, number]): [number, number][] {
  const steps = 64;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const { lat, lon } = interpolateGreatCircle(o[1], o[0], d[1], d[0], i / steps);
    coords.push([lon, lat]);
  }
  return coords;
}

/** MapLibre map plotting every flight's great-circle route, fit to bounds. */
function PassportMap({ routes }: { routes: RouteCoords[] }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const routesRef = useRef<RouteCoords[]>(routes);
  routesRef.current = routes;

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [0, 20],
      zoom: 1.2,
      attributionControl: false,
      interactive: false,
    });

    map.on('load', () => {
      const current = routesRef.current;
      const features = current.map((r) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: buildArc(r.origin, r.destination),
        },
      }));

      map.addSource('passport-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });

      map.addLayer({
        id: 'passport-route-lines',
        type: 'line',
        source: 'passport-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#007AFF',
          'line-width': 1.6,
          'line-opacity': 0.55,
        },
      });

      const endpoints: [number, number][] = [];
      for (const r of current) {
        endpoints.push(r.origin, r.destination);
      }
      const endpointFeatures = endpoints.map((p) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Point' as const, coordinates: p },
      }));
      map.addSource('passport-endpoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: endpointFeatures },
      });
      map.addLayer({
        id: 'passport-endpoint-dots',
        type: 'circle',
        source: 'passport-endpoints',
        paint: {
          'circle-radius': 2.6,
          'circle-color': '#FF3B30',
          'circle-opacity': 0.85,
        },
      });

      // Fit the viewport to include every plotted point.
      if (endpoints.length > 0) {
        const bounds = new maplibregl.LngLatBounds(endpoints[0], endpoints[0]);
        for (const p of endpoints) bounds.extend(p);
        map.fitBounds(bounds, { padding: 36, duration: 0, maxZoom: 6 });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mapContainer} className="w-full h-full" />;
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-[var(--text-primary)] leading-tight">{value}</div>
        <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

export default function Passport({ flights }: { flights: Flight[] }) {
  const stats = useMemo(() => computeStats(flights), [flights]);

  const routes = useMemo<RouteCoords[]>(() => {
    const out: RouteCoords[] = [];
    for (const f of flights) {
      const { origin, destination } = f;
      if (isMissingCoord(origin.lat, origin.lon)) continue;
      if (isMissingCoord(destination.lat, destination.lon)) continue;
      out.push({
        origin: [origin.lon, origin.lat],
        destination: [destination.lon, destination.lat],
      });
    }
    return out;
  }, [flights]);

  const topAirlines = stats.airlines.slice(0, 6);
  const { sampled, avgErrorMin } = stats.predictionAccuracy;

  if (flights.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="max-w-lg mx-auto"
      >
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Passport</h1>
        </div>
        <div className="card p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
            <Globe size={28} className="text-[var(--text-tertiary)]" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            No flights yet — your travel map will appear here.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Passport</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          {stats.totalFlights} flight{stats.totalFlights !== 1 ? 's' : ''} •{' '}
          {stats.totalMiles.toLocaleString()} miles
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          icon={<AirplaneTilt size={18} weight="fill" className="text-[#007AFF]" />}
          label="Flights"
          value={stats.totalFlights.toLocaleString()}
        />
        <StatCard
          icon={<Path size={18} weight="fill" className="text-[#007AFF]" />}
          label="Miles"
          value={stats.totalMiles.toLocaleString()}
        />
        <StatCard
          icon={<Globe size={18} weight="fill" className="text-[#007AFF]" />}
          label="Countries"
          value={stats.uniqueCountries.toLocaleString()}
        />
        <StatCard
          icon={<Buildings size={18} weight="fill" className="text-[#007AFF]" />}
          label="Airports"
          value={stats.uniqueAirports.toLocaleString()}
        />
      </div>

      {/* Map */}
      <div className="card p-3 mb-4">
        <div className="rounded-2xl overflow-hidden h-64 relative">
          {routes.length > 0 ? (
            <PassportMap routes={routes} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[var(--bg-tertiary)]">
              <MapPin size={22} className="text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)]">No mappable routes yet</span>
            </div>
          )}
        </div>
      </div>

      {/* Airlines breakdown */}
      {topAirlines.length > 0 && (
        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Airplane size={16} weight="fill" className="text-[#007AFF]" />
            Airlines
          </h3>
          <div className="space-y-2.5">
            {topAirlines.map((a) => (
              <div key={a.code} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[var(--text-tertiary)] w-8 shrink-0">
                  {a.code}
                </span>
                <span className="text-sm text-[var(--text-primary)] flex-1 min-w-0 truncate">
                  {a.name}
                </span>
                <span className="text-sm font-semibold text-[var(--text-secondary)] tabular-nums">
                  {a.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction accuracy */}
      <div className="card p-4 mb-8 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
          <Target size={18} weight="fill" className="text-[#34C759]" />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {sampled > 0 && avgErrorMin !== null
            ? `Predictions within ${avgErrorMin} min avg over ${sampled} flight${sampled !== 1 ? 's' : ''}`
            : 'Not enough data yet'}
        </p>
      </div>
    </motion.div>
  );
}
