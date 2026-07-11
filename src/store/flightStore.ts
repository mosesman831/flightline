import { get, set, del, keys, createStore } from 'idb-keyval';
import type { Flight } from '../types/flight';
import type { NormalizedFlight } from '../utils/api';
import { snapshotToLiveFields, diffFlightTimeline } from '../utils/liveFlight';
import { predictDelay } from '../utils/predictions';

const flightStore = createStore('flightline-db', 'flights');

export async function getAllFlights(): Promise<Flight[]> {
  const allKeys = await keys(flightStore);
  const all: Flight[] = [];
  for (const key of allKeys) {
    const flight = await get<Flight>(key, flightStore);
    if (flight) all.push(flight);
  }
  return all.sort((a, b) => new Date(a.scheduledDeparture).getTime() - new Date(b.scheduledDeparture).getTime());
}

export async function getActiveFlights(): Promise<Flight[]> {
  const all = await getAllFlights();
  return all.filter((f) => !f.archived);
}

export async function getArchivedFlights(): Promise<Flight[]> {
  const all = await getAllFlights();
  return all.filter((f) => f.archived);
}

export async function getFlight(id: string): Promise<Flight | undefined> {
  return get<Flight>(id, flightStore);
}

/** Persist a flight. Does not mutate its argument. */
export async function saveFlight(flight: Flight): Promise<void> {
  const copy: Flight = { ...flight, lastUpdatedAt: new Date().toISOString() };
  await set(copy.id, copy, flightStore);
}

export async function deleteFlight(id: string): Promise<void> {
  await del(id, flightStore);
  notifyFlightsChanged();
}

export async function archiveFlight(id: string): Promise<void> {
  const flight = await getFlight(id);
  if (flight) {
    await saveFlight({ ...flight, archived: true });
    notifyFlightsChanged();
  }
}

export async function unarchiveFlight(id: string): Promise<void> {
  const flight = await getFlight(id);
  if (flight) {
    await saveFlight({ ...flight, archived: false });
    notifyFlightsChanged();
  }
}

export async function toggleStar(id: string): Promise<void> {
  const flight = await getFlight(id);
  if (flight) {
    await saveFlight({ ...flight, starred: !flight.starred });
    notifyFlightsChanged();
  }
}

export async function updateFlightStatus(id: string, updates: Partial<Flight>): Promise<void> {
  const flight = await getFlight(id);
  if (flight) {
    await saveFlight({ ...flight, ...updates });
    notifyFlightsChanged();
  }
}

/**
 * Merge a live Worker snapshot into a saved flight. Reads once, merges only
 * provider-owned fields, preserves traveller/local fields, generates timeline
 * diffs, recomputes the persisted prediction, writes once, and notifies once.
 * Returns the merged flight (or undefined if the flight no longer exists).
 */
export async function mergeLiveSnapshot(id: string, snapshot: NormalizedFlight): Promise<Flight | undefined> {
  const current = await getFlight(id);
  if (!current) return undefined;

  const liveFields = snapshotToLiveFields(snapshot);
  const events = diffFlightTimeline(current, liveFields, snapshot.statusSource ?? 'live');
  const now = new Date().toISOString();

  const merged: Flight = {
    ...current,
    ...liveFields,
    timeline: events.length > 0 ? [...current.timeline, ...events] : current.timeline,
    lastUpdatedAt: now,
    lastLiveAttemptAt: now,
    lastLiveSuccessAt: now,
    isStale: snapshot.stale,
    lastLiveError: null,
  };

  // Recompute + persist the prediction so list and detail agree.
  const prediction = predictDelay(merged);
  merged.delayChance = prediction.delayChance;
  merged.predictedDeparture = merged.predictedDeparture ?? prediction.predictedDeparture;
  merged.predictedArrival = merged.predictedArrival ?? prediction.predictedArrival;
  merged.delayReasons = prediction.delayReasons;

  await set(id, merged, flightStore);
  notifyFlightsChanged();
  return merged;
}

/** Record a failed live refresh: retain last-known data, mark stale/error. */
export async function recordLiveFailure(id: string, error: string): Promise<void> {
  const current = await getFlight(id);
  if (!current) return;
  const merged: Flight = {
    ...current,
    lastLiveAttemptAt: new Date().toISOString(),
    isStale: true,
    lastLiveError: error,
  };
  await set(id, merged, flightStore);
  notifyFlightsChanged();
}

/** Persist a refreshed live position without touching other fields. */
export async function updateFlightPosition(id: string, position: Flight['livePosition']): Promise<void> {
  const current = await getFlight(id);
  if (!current || !position) return;
  await set(id, { ...current, livePosition: position, positionUpdatedAt: position.observedAt }, flightStore);
  notifyFlightsChanged();
}

/** Find a saved flight by its canonical key (serviceDate:IATA_NUMBER). */
export async function findByCanonicalKey(canonicalKey: string): Promise<Flight | undefined> {
  const all = await getAllFlights();
  return all.find((f) => f.canonicalKey === canonicalKey);
}

export async function addDemoFlightsIfEmpty(): Promise<boolean> {
  const existing = await keys(flightStore);
  if (existing.length > 0) return false;

  const { createMockFlights } = await import('../data/mockFlights');
  const demos = createMockFlights();
  for (const f of demos) {
    await set(f.id, f, flightStore);
  }
  return true;
}

let listenerId = 0;
const listeners = new Map<number, () => void>();

export function subscribeFlights(callback: () => void): () => void {
  const id = ++listenerId;
  listeners.set(id, callback);
  return () => listeners.delete(id);
}

export function notifyFlightsChanged(): void {
  listeners.forEach((cb) => cb());
}

export async function exportFlights(): Promise<string> {
  const all = await getAllFlights();
  return JSON.stringify(all, null, 2);
}

export async function importFlights(json: string): Promise<number> {
  const flights: Flight[] = JSON.parse(json);
  for (const f of flights) {
    await set(f.id, f, flightStore);
  }
  notifyFlightsChanged();
  return flights.length;
}
