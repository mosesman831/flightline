// Module-level tracking of the last observed outcome per provider, powering
// GET /api/providers. Providers start as 'unknown' and are only reported as
// 'ok'/'error' once actually observed (never claim untested providers healthy).
import type { Env, ProviderReport } from './types';

export type ProviderKey = 'aviationstack' | 'airlabs' | 'adsb.lol' | 'opensky' | 'weather' | 'faa';

interface ProviderState {
  lastOutcome: 'ok' | 'error' | 'unknown';
  lastError: string | null;
  lastCheckedAt: string | null;
}

interface ProviderMeta {
  key: ProviderKey;
  name: string;
  requiresKey: boolean;
  data: string;
}

const PROVIDER_META: ProviderMeta[] = [
  { key: 'aviationstack', name: 'Aviationstack', requiresKey: true, data: 'Flight schedules, status, gates, terminals' },
  { key: 'airlabs', name: 'AirLabs', requiresKey: true, data: 'Flight schedules, status, airports, airlines' },
  { key: 'adsb.lol', name: 'ADSB.lol', requiresKey: false, data: 'Live ADS-B position (primary)' },
  { key: 'opensky', name: 'OpenSky Network', requiresKey: false, data: 'Live ADS-B position (fallback)' },
  { key: 'weather', name: 'Aviation Weather', requiresKey: false, data: 'METAR, TAF' },
  { key: 'faa', name: 'FAA NAS Status', requiresKey: false, data: 'Ground stops, ground delays, closures, arrival/departure delays' },
];

const state = new Map<ProviderKey, ProviderState>();

export function recordSuccess(key: ProviderKey, nowMs: number = Date.now()): void {
  state.set(key, { lastOutcome: 'ok', lastError: null, lastCheckedAt: new Date(nowMs).toISOString() });
}

// Record a failure. `message` must already be sanitized (never a raw URL/key).
export function recordError(key: ProviderKey, message: string, nowMs: number = Date.now()): void {
  state.set(key, { lastOutcome: 'error', lastError: message, lastCheckedAt: new Date(nowMs).toISOString() });
}

export function getState(key: ProviderKey): ProviderState {
  return state.get(key) ?? { lastOutcome: 'unknown', lastError: null, lastCheckedAt: null };
}

// Test helper: clear all observed outcomes.
export function resetProviderState(): void {
  state.clear();
}

function isConfigured(meta: ProviderMeta, env: Env): boolean {
  if (!meta.requiresKey) return true;
  if (meta.key === 'aviationstack') return Boolean(env.AVIATIONSTACK_API_KEY);
  if (meta.key === 'airlabs') return Boolean(env.AIRLABS_API_KEY);
  return true;
}

// Build the /api/providers payload. Does NOT probe upstreams.
export function buildProviderReports(env: Env): ProviderReport[] {
  return PROVIDER_META.map((meta) => {
    const s = getState(meta.key);
    return {
      name: meta.name,
      key: meta.key,
      configured: isConfigured(meta, env),
      requiresKey: meta.requiresKey,
      lastOutcome: s.lastOutcome,
      lastError: s.lastError,
      lastCheckedAt: s.lastCheckedAt,
      data: meta.data,
    };
  });
}
