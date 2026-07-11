// Converts Worker snapshots into the local Flight model and computes safe
// merges that preserve traveller-entered fields while updating provider-owned
// live fields and generating timeline diffs.
import type { Flight, Airport, StatusEvent, LivePosition } from '../types/flight';
import type { NormalizedFlight, ApiAirport, ApiLivePosition } from './api';
import { AIRPORTS } from '../data/airports';
import { getAirline } from '../data/airlines';
import { generateId } from './format';

/** Resolve a rich local Airport from an API airport, falling back safely. */
export function resolveAirport(api: ApiAirport): Airport {
  const local = api.iata ? AIRPORTS[api.iata.toUpperCase()] : undefined;
  if (local) return local;
  return {
    iata: api.iata || '',
    icao: api.icao || '',
    name: api.name || api.iata || 'Unknown',
    city: api.name || api.iata || '',
    country: '',
    timezone: 'UTC',
    lat: 0,
    lon: 0,
  };
}

/** Normalize an API live position into the local LivePosition shape. */
export function toLivePosition(p: ApiLivePosition | null): LivePosition | null {
  if (!p) return null;
  return {
    icao24: p.icao24,
    callsign: p.callsign,
    latitude: p.latitude,
    longitude: p.longitude,
    altitudeFt: p.altitudeFt,
    groundSpeedKt: p.groundSpeedKt,
    heading: p.heading,
    verticalRateFpm: p.verticalRateFpm,
    onGround: p.onGround,
    observedAt: p.observedAt,
    stale: p.stale,
    source: p.source,
  };
}

/**
 * Extract only the provider-owned ("live") fields from a snapshot. Traveller
 * and local fields (seat, cabin, notes, archived, starred, etc.) are never
 * included here so a merge cannot clobber them. Null schedule values are
 * omitted so we retain the last known good value.
 */
export function snapshotToLiveFields(s: NormalizedFlight): Partial<Flight> {
  const fields: Partial<Flight> = {
    airlineIata: s.airlineIata,
    airlineName: s.airlineName || getAirline(s.airlineIata).name,
    flightNumber: s.flightNumber,
    iataNumber: s.iataNumber,
    canonicalKey: s.canonicalKey,
    date: s.serviceDate,
    origin: resolveAirport(s.origin),
    destination: resolveAirport(s.destination),
    status: s.status,
    delayMinutes: s.delayMinutes,
    gate: s.gate,
    terminal: s.terminal,
    aircraft: s.aircraft,
    tailNumber: s.registration,
    statusSource: s.statusSource,
    positionSource: s.positionSource,
    dataSources: s.dataSources,
  };
  if (s.scheduledDeparture) fields.scheduledDeparture = s.scheduledDeparture;
  if (s.scheduledArrival) fields.scheduledArrival = s.scheduledArrival;
  // estimates/actuals: use ?? so an explicit null clears nothing but a value updates
  if (s.estimatedDeparture !== null) fields.predictedDeparture = s.estimatedDeparture;
  if (s.estimatedArrival !== null) fields.predictedArrival = s.estimatedArrival;
  fields.actualDeparture = s.actualDeparture;
  fields.actualArrival = s.actualArrival;
  const pos = toLivePosition(s.livePosition);
  if (pos) {
    fields.livePosition = pos;
    fields.positionUpdatedAt = pos.observedAt;
  }
  return fields;
}

const TIMELINE_FIELDS: { key: keyof Flight; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'gate', label: 'Gate' },
  { key: 'terminal', label: 'Terminal' },
  { key: 'predictedDeparture', label: 'Predicted departure' },
  { key: 'predictedArrival', label: 'Predicted arrival' },
  { key: 'aircraft', label: 'Aircraft' },
  { key: 'tailNumber', label: 'Tail number' },
];

function displayValue(key: keyof Flight, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'predictedDeparture' || key === 'predictedArrival') {
    const d = new Date(value as string);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
  }
  return String(value);
}

/**
 * Produce timeline entries for any provider-owned field that changed between
 * the previous flight and the incoming live fields.
 */
export function diffFlightTimeline(prev: Flight, next: Partial<Flight>, source: string): StatusEvent[] {
  const events: StatusEvent[] = [];
  const now = new Date().toISOString();
  for (const { key, label } of TIMELINE_FIELDS) {
    if (!(key in next)) continue;
    const oldVal = prev[key];
    const newVal = next[key];
    // Skip when unchanged or when the new value is empty (don't record clearing to unknown).
    if (newVal === null || newVal === undefined || newVal === '') continue;
    if (oldVal === newVal) continue;
    events.push({
      id: generateId(),
      field: label,
      oldValue: displayValue(key, oldVal),
      newValue: displayValue(key, newVal),
      recordedAt: now,
    });
  }
  // Note the source on the first event of the batch for provenance.
  if (events.length > 0 && source) {
    events[events.length - 1] = { ...events[events.length - 1] };
  }
  return events;
}

/**
 * Build a brand new Flight from a track snapshot, applying traveller fields
 * captured on the add form. Never synthesizes noon/+4h data.
 */
export function buildFlightFromSnapshot(
  s: NormalizedFlight,
  traveller: {
    seatNumber?: string | null;
    checkInDesk?: string | null;
    cabinClass?: Flight['cabinClass'];
    personalNotes?: string | null;
  },
): Flight {
  const live = snapshotToLiveFields(s);
  const now = new Date().toISOString();
  const scheduledDeparture = s.scheduledDeparture ?? `${s.serviceDate}T00:00:00Z`;
  const scheduledArrival = s.scheduledArrival ?? scheduledDeparture;
  return {
    id: generateId(),
    airlineIata: s.airlineIata,
    airlineName: s.airlineName || getAirline(s.airlineIata).name,
    flightNumber: s.flightNumber,
    date: s.serviceDate,
    scheduledDeparture,
    scheduledArrival,
    predictedDeparture: s.estimatedDeparture,
    predictedArrival: s.estimatedArrival,
    actualDeparture: s.actualDeparture,
    actualArrival: s.actualArrival,
    origin: resolveAirport(s.origin),
    destination: resolveAirport(s.destination),
    status: s.status,
    delayMinutes: s.delayMinutes,
    delayChance: 0,
    delayReasons: [],
    gate: s.gate,
    terminal: s.terminal,
    aircraft: s.aircraft,
    tailNumber: s.registration,
    seatNumber: traveller.seatNumber ?? null,
    checkInDesk: traveller.checkInDesk ?? null,
    baggageReclaim: null,
    personalNotes: traveller.personalNotes ?? null,
    boardingGroup: null,
    boardingTime: null,
    cabinClass: traveller.cabinClass ?? null,
    timeline: [],
    inbound: null,
    pilotData: null,
    departureWeather: [],
    arrivalWeather: [],
    addedAt: now,
    lastUpdatedAt: now,
    isDemo: false,
    archived: false,
    starred: false,
    canonicalKey: s.canonicalKey,
    iataNumber: s.iataNumber,
    statusSource: s.statusSource,
    positionSource: s.positionSource,
    dataSources: s.dataSources,
    livePosition: live.livePosition ?? null,
    positionUpdatedAt: live.positionUpdatedAt ?? null,
    lastLiveAttemptAt: now,
    lastLiveSuccessAt: now,
    isStale: s.stale,
    lastLiveError: null,
  };
}

/** True when a flight has reached a terminal state (no further polling). */
export function isTerminalStatus(status: Flight['status']): boolean {
  return status === 'landed' || status === 'cancelled' || status === 'diverted';
}

/** The full IATA number used for Worker lookups. */
export function flightIataNumber(f: Flight): string {
  return f.iataNumber || `${f.airlineIata}${f.flightNumber}`.toUpperCase();
}
