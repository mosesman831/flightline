// Foreground / installed-app smart notification engine (SPEC §12.3c).
//
// This module runs ONLY while the PWA is open. It arms local `setTimeout`
// timers for time-based alerts (leave-for-airport, boarding-soon) and reacts
// to freshly-polled flight snapshots for change-based alerts (gate change,
// inbound-late, status change). A localStorage-backed dedupe store prevents
// re-notifying the same event, and a 2-minute coalescing window collapses
// bursty events (gate/status churn) into a single, continuously-updated
// notification per flight.

import type { Flight, FlightStatus } from '../types/flight';
import { loadPrefs, type NotificationPrefs } from './notificationPrefs';
import { sendLocalNotification } from './notifications';

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/** LocalStorage key for the dedupe map (`{ [dedupeKey]: firedAtMs }`). */
export const DEDUPE_STORAGE_KEY = 'flightline-notif-dedupe';

const MINUTE_MS = 60_000;
/** Lead time before departure at which the "leave now" alert fires. */
const LEAVE_LEAD_MS = 30 * MINUTE_MS;
/** Lead time before boarding at which the "boarding soon" alert fires. */
const BOARDING_LEAD_MS = 30 * MINUTE_MS;
/** Inbound aircraft is considered "late" once it crosses this threshold. */
const INBOUND_LATE_THRESHOLD_MIN = 10;
/** Debounce before the first coalesced notification publishes (max wait). */
const COALESCE_FIRST_DELAY_MS = 30 * 1000;
/** Rolling window during which further events update the same notification. */
const COALESCE_WINDOW_MS = 2 * MINUTE_MS;
/** setTimeout is unreliable past the signed-32-bit millisecond ceiling. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** Flight statuses that are considered terminal (no further scheduling). */
const TERMINAL_STATUSES: ReadonlySet<FlightStatus> = new Set<FlightStatus>([
  'landed',
  'cancelled',
  'diverted',
]);

/** Statuses whose entry triggers a status-change alert. */
const ALERTABLE_STATUSES: ReadonlySet<FlightStatus> = new Set<FlightStatus>([
  'delayed',
  'cancelled',
  'diverted',
]);

/** Discriminates the kind of event encoded in a dedupe key. */
type NotifEvent = 'leave' | 'boarding' | 'gate' | 'inbound-late' | 'status';

// ─────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────

/** Armed time-based timers, keyed by dedupe key so rebuilds can clear them. */
const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface CoalesceState {
  /** Timestamp (ms) the current window opened. */
  windowStart: number;
  /** Timer that publishes the first notification after the debounce. */
  publishTimer?: ReturnType<typeof setTimeout>;
  /** Whether the first notification for this window has been shown. */
  published: boolean;
  /** Most-recent pending payload (latest event wins before first publish). */
  pending: CoalescePayload | null;
}

interface CoalescePayload {
  title: string;
  body: string;
  dedupeKey: string;
  flightId: string;
}

/** Per-flight coalescing windows, keyed by flight id. */
const coalesceStates = new Map<string, CoalesceState>();

// ─────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────

const now = (): number => Date.now();

/** Parse an ISO timestamp to epoch ms, or `null` when absent/invalid. */
function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Build the dedupe key for a given flight/event/value triple. */
function dedupeKey(flightId: string, event: NotifEvent, value: string): string {
  return `${flightId}:${event}:${value}`;
}

function isTerminal(status: FlightStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Human label for a flight, e.g. "BA178". */
function flightLabel(f: Flight): string {
  return `${f.airlineIata}${f.flightNumber}`.trim() || f.flightNumber;
}

/** Notification click-routing helper: hash URL for a flight detail page. */
export function flightDeepLink(flightId: string): string {
  return `/#/flight/${flightId}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Dedupe store (localStorage)
// ─────────────────────────────────────────────────────────────────────────

function loadDedupe(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DEDUPE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number> | null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveDedupe(store: Record<string, number>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage failures
  }
}

function hasDedupe(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(loadDedupe(), key);
}

function addDedupe(key: string): void {
  const store = loadDedupe();
  store[key] = now();
  saveDedupe(store);
}

/**
 * Clear dedupe records. With no argument, wipes everything; with a `flightId`,
 * removes only that flight's keys (used on archive / delete / terminal).
 */
export function resetDedupe(flightId?: string): void {
  if (flightId === undefined) {
    saveDedupe({});
    return;
  }
  const store = loadDedupe();
  const prefix = `${flightId}:`;
  let changed = false;
  for (const key of Object.keys(store)) {
    if (key.startsWith(prefix)) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) saveDedupe(store);
}

// ─────────────────────────────────────────────────────────────────────────
// Notification emission
// ─────────────────────────────────────────────────────────────────────────

/**
 * Show a notification if its dedupe key has not already fired. The stable
 * `tag` lets the platform replace an existing notification for the same flight
 * (used by coalescing) rather than stacking duplicates.
 */
function emit(flightId: string, title: string, body: string, key: string): void {
  if (hasDedupe(key)) return;
  addDedupe(key);
  void sendLocalNotification(title, {
    body,
    tag: `flightline-${flightId}`,
    data: { url: flightDeepLink(flightId) },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Time-based scheduling
// ─────────────────────────────────────────────────────────────────────────

/**
 * Arm a one-shot timer for `fireAt` (epoch ms). Skips events already in the
 * past, already deduped, or too far out for a reliable `setTimeout`.
 */
function scheduleAt(key: string, fireAt: number, fire: () => void): void {
  const delay = fireAt - now();
  if (delay <= 0) return; // never fire past events
  if (delay > MAX_TIMEOUT_MS) return; // beyond reliable timer range
  if (hasDedupe(key)) return; // already fired previously

  const handle = setTimeout(() => {
    scheduledTimers.delete(key);
    fire();
  }, delay);
  scheduledTimers.set(key, handle);
}

/** Preferences bundle plus the flights the scheduler should consider. */
export interface SchedulerCtx {
  flights: Flight[];
  prefs: NotificationPrefs;
}

/**
 * Rebuild all time-based timers from the current flights + prefs. Stale timers
 * are cleared first so this is safe to call whenever flights or prefs change.
 * Change-based alerts (gate/status/inbound) are handled by {@link onFlightPolled}
 * and are unaffected here.
 */
export function rebuildNotificationTimers(ctx: SchedulerCtx): void {
  for (const handle of scheduledTimers.values()) clearTimeout(handle);
  scheduledTimers.clear();

  const { flights, prefs } = ctx;
  if (!prefs.master) return;

  for (const f of flights) {
    if (f.archived || f.isDemo || isTerminal(f.status)) continue;

    // Leave for the airport: departure − transit − 30 min.
    if (prefs.leaveForAirport) {
      const dep = toMs(f.scheduledDeparture);
      if (dep !== null) {
        const fireAt = dep - prefs.transitMinutes * MINUTE_MS - LEAVE_LEAD_MS;
        const key = dedupeKey(f.id, 'leave', f.scheduledDeparture);
        scheduleAt(key, fireAt, () =>
          emit(
            f.id,
            `Time to leave for ${flightLabel(f)}`,
            `Head to the airport now — allow ~${prefs.transitMinutes} min transit before departure.`,
            key,
          ),
        );
      }
    }

    // Boarding soon: boarding − 30 min. Skip entirely when unknown.
    if (prefs.boarding && f.boardingTime) {
      const board = toMs(f.boardingTime);
      if (board !== null) {
        const fireAt = board - BOARDING_LEAD_MS;
        const key = dedupeKey(f.id, 'boarding', f.boardingTime);
        const gateSuffix = f.gate ? ` at gate ${f.gate}` : '';
        scheduleAt(key, fireAt, () =>
          emit(
            f.id,
            `${flightLabel(f)} boards soon`,
            `Boarding begins in 30 minutes${gateSuffix}.`,
            key,
          ),
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Coalescing (gate + rapid status churn)
// ─────────────────────────────────────────────────────────────────────────

/** Publish the first (debounced) notification for a coalescing window. */
function publishFirstCoalesced(flightId: string): void {
  const state = coalesceStates.get(flightId);
  if (!state) return;
  state.publishTimer = undefined;
  state.published = true;
  if (state.pending) {
    const p = state.pending;
    state.pending = null;
    emit(p.flightId, p.title, p.body, p.dedupeKey);
  }
}

/**
 * Feed a coalescable event into the per-flight window.
 * - No / expired window → open a new window and wait up to 30 s before the
 *   first publish (latest event wins during that debounce).
 * - Active window, already published → update the tagged notification now.
 * - Active window, not yet published → replace the pending payload.
 */
function enqueueCoalesced(payload: CoalescePayload): void {
  const t = now();
  const existing = coalesceStates.get(payload.flightId);

  if (existing && t - existing.windowStart < COALESCE_WINDOW_MS) {
    if (existing.published) {
      emit(payload.flightId, payload.title, payload.body, payload.dedupeKey);
    } else {
      existing.pending = payload; // latest wins before first publish
    }
    return;
  }

  // Open a fresh window.
  if (existing?.publishTimer) clearTimeout(existing.publishTimer);
  const state: CoalesceState = {
    windowStart: t,
    published: false,
    pending: payload,
  };
  state.publishTimer = setTimeout(
    () => publishFirstCoalesced(payload.flightId),
    COALESCE_FIRST_DELAY_MS,
  );
  coalesceStates.set(payload.flightId, state);
}

// ─────────────────────────────────────────────────────────────────────────
// Poll-driven change detection
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compare a freshly-polled flight snapshot (`next`) against its previous state
 * (`prev`) and emit gate-change / inbound-late / status-change alerts per the
 * rules. Respects live preferences (loaded fresh each call) and dedupe. Emits
 * nothing when notifications are disabled or the flight is archived/demo.
 */
export function onFlightPolled(prev: Flight | undefined, next: Flight): void {
  const prefs = loadPrefs();
  if (!prefs.master) return;
  if (next.archived || next.isDemo) return;

  const label = flightLabel(next);
  const nextTerminal = isTerminal(next.status);

  // Gate change — coalescable. Not for terminal flights.
  if (
    prefs.gateChange &&
    !nextTerminal &&
    prev !== undefined &&
    next.gate &&
    next.gate !== prev.gate
  ) {
    const key = dedupeKey(next.id, 'gate', next.gate);
    if (!hasDedupe(key)) {
      enqueueCoalesced({
        flightId: next.id,
        dedupeKey: key,
        title: `Gate change for ${label}`,
        body: `${label} now departs from gate ${next.gate}.`,
      });
    }
  }

  // Inbound aircraft late — direct (dedupe-guarded), once per inbound leg.
  if (prefs.inboundLate && !nextTerminal && next.inbound) {
    const sched = toMs(next.inbound.scheduledArrival);
    const est = toMs(next.inbound.actualArrival) ?? sched;
    if (sched !== null && est !== null) {
      const lateMin = Math.round((est - sched) / MINUTE_MS);
      if (lateMin > INBOUND_LATE_THRESHOLD_MIN) {
        const key = dedupeKey(next.id, 'inbound-late', next.inbound.scheduledArrival);
        emit(
          next.id,
          `Inbound aircraft delayed`,
          `The inbound aircraft for ${label} is running ~${lateMin} min late.`,
          key,
        );
      }
    }
  }

  // Status change — coalescable. Fires on transition INTO an alertable status,
  // including terminal cancelled/diverted (the announcement of entering it).
  if (
    prefs.statusChange &&
    prev !== undefined &&
    prev.status !== next.status &&
    ALERTABLE_STATUSES.has(next.status)
  ) {
    const key = dedupeKey(next.id, 'status', next.status);
    if (!hasDedupe(key)) {
      const delaySuffix =
        next.status === 'delayed' && next.delayMinutes
          ? ` (~${next.delayMinutes} min)`
          : '';
      enqueueCoalesced({
        flightId: next.id,
        dedupeKey: key,
        title: `${label} ${next.status}`,
        body: `Status changed to ${next.status}${delaySuffix}.`,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────────────────────────────────

/**
 * Clear all in-memory timers and coalescing state. Persisted dedupe records
 * are intentionally left intact (use {@link resetDedupe} to clear those).
 */
export function clearAllTimers(): void {
  for (const handle of scheduledTimers.values()) clearTimeout(handle);
  scheduledTimers.clear();

  for (const state of coalesceStates.values()) {
    if (state.publishTimer) clearTimeout(state.publishTimer);
  }
  coalesceStates.clear();
}
