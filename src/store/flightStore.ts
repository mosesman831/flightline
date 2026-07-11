import { get, set, del, keys, createStore } from 'idb-keyval';
import type { Flight } from '../types/flight';

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

export async function saveFlight(flight: Flight): Promise<void> {
  flight.lastUpdatedAt = new Date().toISOString();
  await set(flight.id, flight, flightStore);
}

export async function deleteFlight(id: string): Promise<void> {
  await del(id, flightStore);
}

export async function archiveFlight(id: string): Promise<void> {
  const flight = await getFlight(id);
  if (flight) {
    flight.archived = true;
    await saveFlight(flight);
  }
}

export async function unarchiveFlight(id: string): Promise<void> {
  const flight = await getFlight(id);
  if (flight) {
    flight.archived = false;
    await saveFlight(flight);
  }
}

export async function toggleStar(id: string): Promise<void> {
  const flight = await getFlight(id);
  if (flight) {
    flight.starred = !flight.starred;
    await saveFlight(flight);
  }
}

export async function updateFlightStatus(id: string, updates: Partial<Flight>): Promise<void> {
  const flight = await getFlight(id);
  if (flight) {
    Object.assign(flight, updates);
    flight.lastUpdatedAt = new Date().toISOString();
    await set(id, flight, flightStore);
  }
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
