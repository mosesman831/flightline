// Pure normalization helpers: input validation, canonical keys, status mapping,
// date handling, and provider unit conversions. Everything here is side-effect
// free and import-testable without a running Worker.
import type { FlightStatus } from './types';

// --- Input validation & canonicalization -----------------------------------

export interface TrackInput {
  airlineIata: string;
  flightNumber: string;
  date: string;
  iataNumber: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const AIRLINE_RE = /^[A-Z0-9]{2,3}$/;
const FLIGHT_NUMBER_RE = /^[0-9]{1,4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validate a YYYY-MM-DD string as a real calendar date.
export function isValidDate(date: unknown): date is string {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

// Build the canonical full IATA number, e.g. ("ba", "178") -> "BA178".
// Airline code is uppercased; flight number digits are kept exactly as given
// (no leading-zero stripping).
export function canonicalIataNumber(airlineIata: string, flightNumber: string): string {
  return `${airlineIata.trim().toUpperCase()}${flightNumber.trim()}`;
}

// Canonical cache/identity key: "YYYY-MM-DD:IATA_NUMBER".
export function canonicalKey(serviceDate: string, iataNumber: string): string {
  return `${serviceDate}:${iataNumber.toUpperCase()}`;
}

// Validate the POST /api/track body.
export function validateTrackInput(body: unknown): ValidationResult<TrackInput> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  const rawAirline = b.airlineIata;
  if (typeof rawAirline !== 'string') {
    return { ok: false, message: 'airlineIata is required' };
  }
  const airlineIata = rawAirline.trim().toUpperCase();
  if (!AIRLINE_RE.test(airlineIata)) {
    return { ok: false, message: 'airlineIata must be a 2-3 character IATA/ICAO airline code' };
  }

  // Accept a string or number for the flight number.
  let flightNumber: string;
  if (typeof b.flightNumber === 'string') {
    flightNumber = b.flightNumber.trim();
  } else if (typeof b.flightNumber === 'number' && Number.isInteger(b.flightNumber)) {
    flightNumber = String(b.flightNumber);
  } else {
    return { ok: false, message: 'flightNumber is required' };
  }
  if (!FLIGHT_NUMBER_RE.test(flightNumber)) {
    return { ok: false, message: 'flightNumber must be 1-4 digits' };
  }

  if (!isValidDate(b.date)) {
    return { ok: false, message: 'date must be a valid YYYY-MM-DD calendar date' };
  }

  return {
    ok: true,
    value: {
      airlineIata,
      flightNumber,
      date: b.date,
      iataNumber: canonicalIataNumber(airlineIata, flightNumber),
    },
  };
}

// Validate a bare IATA number path parameter (e.g. "BA178").
const IATA_NUMBER_RE = /^[A-Z0-9]{2,3}[0-9]{1,4}$/;
export function validateIataNumber(raw: string): ValidationResult<string> {
  const iataNumber = raw.trim().toUpperCase();
  if (!IATA_NUMBER_RE.test(iataNumber)) {
    return { ok: false, message: 'Invalid IATA flight number' };
  }
  return { ok: true, value: iataNumber };
}

export function isHex24(raw: string): boolean {
  return /^[0-9a-fA-F]{6}$/.test(raw.trim());
}

export function isIcaoAirport(raw: string): boolean {
  return /^[A-Za-z]{4}$/.test(raw.trim());
}

// --- Status normalization ---------------------------------------------------

// Map heterogeneous provider status strings into the shared FlightStatus union.
export function normalizeStatus(raw: unknown): FlightStatus {
  const s = (raw == null ? '' : String(raw)).toLowerCase().trim().replace(/[_-]+/g, ' ');
  switch (s) {
    case 'boarding':
      return 'boarding';
    case 'active':
    case 'en route':
    case 'enroute':
    case 'in air':
    case 'airborne':
    case 'departed':
      return 'active';
    case 'landed':
    case 'arrived':
      return 'landed';
    case 'delayed':
      return 'delayed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'diverted':
    case 'redirected':
    case 'incident':
      return 'diverted';
    case 'scheduled':
    case 'unknown':
    case '':
      return 'scheduled';
    default:
      return 'scheduled';
  }
}

// --- Date & datetime helpers ------------------------------------------------

// Return the trimmed string only if it parses as a valid date; else null.
// Aviationstack already emits ISO 8601 with offset, so this is a pass-through
// validator for those fields.
export function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return trimmed;
}

// Convert an AirLabs "*_utc" value (e.g. "2024-01-15 14:30") into ISO 8601 with
// an explicit Z offset. Returns null if unparseable.
export function airlabsUtcToIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let v = value.trim();
  if (!v) return null;
  v = v.replace(' ', 'T');
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(v)) {
    v = `${v}Z`;
  }
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

// Extract the local YYYY-MM-DD date part from a provider-local datetime string
// like "2024-01-15 14:30" or "2024-01-15T14:30:00+01:00".
export function localDatePart(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// Independent verification that a provider's local departure date equals the
// requested service date.
export function matchesDate(localDepartureDate: string | null, requestedDate: string): boolean {
  return localDepartureDate !== null && localDepartureDate === requestedDate;
}

// --- Unit conversions -------------------------------------------------------
// Zero is a valid measurement; only null/undefined map to null.

export function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function metersToFeet(meters: unknown): number | null {
  const v = numOrNull(meters);
  return v === null ? null : v * 3.28084;
}

export function msToKnots(ms: unknown): number | null {
  const v = numOrNull(ms);
  return v === null ? null : v * 1.94384;
}

export function msToFpm(ms: unknown): number | null {
  const v = numOrNull(ms);
  return v === null ? null : v * 196.85;
}

export function statuteMilesToKm(miles: unknown): number | null {
  const v = numOrNull(miles);
  return v === null ? null : v * 1.60934;
}

// adsb.lol reports "seconds seen ago"; convert to an absolute ISO timestamp.
export function observedAtFromSeen(seenSeconds: unknown, nowMs: number): string {
  const seen = numOrNull(seenSeconds) ?? 0;
  return new Date(nowMs - seen * 1000).toISOString();
}

// OpenSky reports last_contact as absolute epoch seconds.
export function observedAtFromEpoch(epochSeconds: unknown, nowMs: number): string {
  const epoch = numOrNull(epochSeconds);
  return new Date(epoch === null ? nowMs : epoch * 1000).toISOString();
}

// A position is considered "not live" (stale) once older than 60 seconds.
export function isPositionStale(observedAtIso: string, nowMs: number): boolean {
  const ms = Date.parse(observedAtIso);
  if (Number.isNaN(ms)) return true;
  return nowMs - ms > 60_000;
}
