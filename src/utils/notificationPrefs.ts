// Persisted notification preferences for Flightline (SPEC §12.3c).
//
// Preferences are stored as a single JSON blob under one localStorage key.
// A merge-over-defaults strategy is used on load so that adding new toggles
// in future versions never breaks a previously-persisted payload.

/** LocalStorage key holding the JSON-encoded {@link NotificationPrefs}. */
export const PREFS_STORAGE_KEY = 'flightline-notification-prefs';

/** User-configurable smart-notification preferences. */
export interface NotificationPrefs {
  /** Master switch — when false, no notifications fire regardless of the toggles below. */
  master: boolean;
  /** "Time to leave for the airport" alert. */
  leaveForAirport: boolean;
  /** "Boarding soon" alert. */
  boarding: boolean;
  /** "Gate changed" alert. */
  gateChange: boolean;
  /** "Inbound aircraft is running late" alert. */
  inboundLate: boolean;
  /** "Flight status changed" alert (delayed / cancelled / diverted). */
  statusChange: boolean;
  /** Estimated door-to-gate transit time in minutes, used by the leave-for-airport rule. */
  transitMinutes: number;
}

/**
 * Default preferences. The master switch ships OFF (opt-in), while every
 * individual alert type defaults ON so enabling the master switch is useful
 * immediately. Transit time defaults to 45 minutes.
 */
export const DEFAULT_PREFS: NotificationPrefs = {
  master: false,
  leaveForAirport: true,
  boarding: true,
  gateChange: true,
  inboundLate: true,
  statusChange: true,
  transitMinutes: 45,
};

/**
 * Load preferences from localStorage, merging any stored values over
 * {@link DEFAULT_PREFS}. Unknown/missing keys fall back to their defaults and
 * malformed JSON yields a fresh copy of the defaults.
 */
export function loadPrefs(): NotificationPrefs {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs> | null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Persist preferences to localStorage as JSON. Failures are swallowed. */
export function savePrefs(p: NotificationPrefs): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Storage full / unavailable (e.g. private mode) — ignore.
  }
}
