// Single guarded refresh pipeline shared by polling, pull-to-refresh, the
// detail Refresh action, the `r` shortcut, window focus, and reconnect.
import type { Flight } from '../types/flight';
import { fetchFlightSnapshot, fetchPositionByIcao, fetchPositionByCallsign } from './api';
import {
  getFlight,
  getActiveFlights,
  mergeLiveSnapshot,
  recordLiveFailure,
  updateFlightPosition,
} from '../store/flightStore';
import { isTerminalStatus, flightIataNumber, toLivePosition } from './liveFlight';
import { onFlightPolled } from './notificationScheduler';

export type RefreshResult = 'fresh' | 'stale' | 'failed' | 'skipped';

// Status polling cadences (ms).
export const ACTIVE_WINDOW_INTERVAL_MS = 60_000; // T-3h .. terminal
export const SCHEDULED_INTERVAL_MS = 300_000; // scheduled > 3h away
export const POSITION_INTERVAL_MS = 15_000; // detail map only
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

const inFlight = new Set<string>();

/** The status-poll interval that currently applies to a flight. */
export function pollIntervalFor(flight: Flight, now: number = Date.now()): number {
  const dep = new Date(flight.scheduledDeparture).getTime();
  if (Number.isNaN(dep)) return SCHEDULED_INTERVAL_MS;
  return dep - now > THREE_HOURS_MS ? SCHEDULED_INTERVAL_MS : ACTIVE_WINDOW_INTERVAL_MS;
}

/** Whether a flight should be polled at all right now. */
export function shouldPoll(flight: Flight): boolean {
  return !flight.isDemo && !flight.archived && !isTerminalStatus(flight.status);
}

/** Whether enough time has elapsed since the last successful refresh. */
export function isDue(flight: Flight, now: number = Date.now()): boolean {
  const last = flight.lastLiveSuccessAt ? new Date(flight.lastLiveSuccessAt).getTime() : 0;
  return now - last >= pollIntervalFor(flight, now);
}

/**
 * Refresh a single flight's status. Guards against overlapping refreshes,
 * skips demo/archived/terminal flights, and retains last-known data on failure.
 */
export async function refreshFlight(id: string): Promise<RefreshResult> {
  const flight = await getFlight(id);
  if (!flight || !shouldPoll(flight)) return 'skipped';
  if (inFlight.has(id)) return 'skipped';

  inFlight.add(id);
  try {
    const snapshot = await fetchFlightSnapshot(flightIataNumber(flight), flight.date);
    if (!snapshot) {
      await recordLiveFailure(id, 'Live data unavailable');
      return 'failed';
    }
    const merged = await mergeLiveSnapshot(id, snapshot);
    if (merged) onFlightPolled(flight, merged);
    return snapshot.stale ? 'stale' : 'fresh';
  } catch {
    await recordLiveFailure(id, 'Refresh failed');
    return 'failed';
  } finally {
    inFlight.delete(id);
  }
}

/** Run tasks with bounded concurrency to avoid stampeding the Worker/providers. */
async function withConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<unknown>): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/**
 * Refresh every active flight that is due (or force all when `force`). Uses
 * bounded concurrency rather than blocking serially.
 */
export async function refreshAllDue(options: { force?: boolean } = {}): Promise<void> {
  const active = await getActiveFlights();
  const now = Date.now();
  const targets = active.filter((f) => shouldPoll(f) && (options.force || isDue(f, now)));
  await withConcurrency(targets, 4, (f) => refreshFlight(f.id));
}

/**
 * Refresh a single flight's live position (detail map only). Prefers a known
 * ICAO24, otherwise the operational callsign built from the IATA number.
 */
export async function refreshPosition(id: string): Promise<boolean> {
  const flight = await getFlight(id);
  if (!flight || flight.isDemo) return false;
  try {
    let pos = null;
    const icao24 = flight.livePosition?.icao24;
    if (icao24) {
      pos = await fetchPositionByIcao(icao24);
    }
    if (!pos) {
      // Fall back to a callsign search using the IATA number as a best effort.
      pos = await fetchPositionByCallsign(flightIataNumber(flight));
    }
    const normalized = toLivePosition(pos);
    if (normalized) {
      await updateFlightPosition(id, normalized);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
