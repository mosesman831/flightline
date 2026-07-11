/**
 * Deterministic great-circle geo helpers.
 *
 * Pure, dependency-free functions for computing distances, bearings and
 * intermediate points on a spherical Earth (mean radius R = 6371 km).
 */

/** Mean Earth radius in kilometres. */
const EARTH_RADIUS_KM = 6371;

/** Miles per kilometre conversion factor. */
const KM_TO_MILES = 0.621371;

/** Convert degrees to radians. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Convert radians to degrees. */
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** True when every supplied value is a finite number. */
function allFinite(...values: number[]): boolean {
  return values.every((v) => Number.isFinite(v));
}

/** True when both endpoints are exactly the null island (0,0). */
function bothNullIsland(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): boolean {
  return lat1 === 0 && lon1 === 0 && lat2 === 0 && lon2 === 0;
}

/**
 * Haversine great-circle distance in kilometres, rounded to the nearest
 * integer.
 *
 * Returns 0 when both endpoints are exactly 0/0 or when any input is NaN
 * (or otherwise non-finite).
 */
export function greatCircleKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (!allFinite(lat1, lon1, lat2, lon2)) return 0;
  if (bothNullIsland(lat1, lon1, lat2, lon2)) return 0;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_KM * c);
}

/**
 * Great-circle distance in miles, rounded to the nearest integer.
 *
 * Computed as the kilometre distance multiplied by 0.621371.
 */
export function greatCircleMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (!allFinite(lat1, lon1, lat2, lon2)) return 0;
  if (bothNullIsland(lat1, lon1, lat2, lon2)) return 0;

  const km = greatCircleKm(lat1, lon1, lat2, lon2);
  return Math.round(km * KM_TO_MILES);
}

/**
 * Initial great-circle bearing from point 1 to point 2, in degrees.
 *
 * Normalised to the range [0, 360). Returns 0 for non-finite inputs.
 */
export function initialBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (!allFinite(lat1, lon1, lat2, lon2)) return 0;

  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x =
    Math.cos(rLat1) * Math.sin(rLat2) -
    Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Point at `fraction` (0..1) along the great-circle path between two points,
 * using spherical linear interpolation (slerp).
 *
 * `fraction` is clamped to [0, 1]. Non-finite inputs fall back to point 1.
 */
export function interpolateGreatCircle(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  fraction: number,
): { lat: number; lon: number } {
  if (!allFinite(lat1, lon1, lat2, lon2)) {
    return { lat: lat1, lon: lon1 };
  }

  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;

  const rLat1 = toRadians(lat1);
  const rLon1 = toRadians(lon1);
  const rLat2 = toRadians(lat2);
  const rLon2 = toRadians(lon2);

  // Angular distance between the two points (central angle).
  const dLat = rLat2 - rLat1;
  const dLon = rLon2 - rLon1;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const delta = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Coincident (or effectively coincident) points: nothing to interpolate.
  if (delta === 0) {
    return { lat: lat1, lon: lon1 };
  }

  const sinDelta = Math.sin(delta);
  const A = Math.sin((1 - f) * delta) / sinDelta;
  const B = Math.sin(f * delta) / sinDelta;

  // Convert to Cartesian, blend, then back to lat/lon.
  const x =
    A * Math.cos(rLat1) * Math.cos(rLon1) +
    B * Math.cos(rLat2) * Math.cos(rLon2);
  const y =
    A * Math.cos(rLat1) * Math.sin(rLon1) +
    B * Math.cos(rLat2) * Math.sin(rLon2);
  const z = A * Math.sin(rLat1) + B * Math.sin(rLat2);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);

  return { lat: toDegrees(lat), lon: toDegrees(lon) };
}
