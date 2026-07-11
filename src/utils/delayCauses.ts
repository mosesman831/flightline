import type { Flight, DelayReason, DelaySeverity } from '../types/flight';
import type { ApiNasStatus } from './api';
import { predictDelay } from './predictions';

// ─────────────────────────────────────────────────────────────────────────────
// Merge the labeled heuristic prediction reasons with any live FAA NAS
// (National Airspace System) advisories, producing a single ranked list of
// delay causes plus a one-line human summary of the most impactful one.
//
// Pure and deterministic: given the same flight + NAS input it always returns
// the same result.
// ─────────────────────────────────────────────────────────────────────────────

export interface DelayCausesResult {
  reasons: DelayReason[];
  summary: string | null;
}

/** Build a NAS-derived cause from a single FAA advisory event. */
function nasEventToReason(
  event: ApiNasStatus['events'][number],
  airport: string,
): DelayReason {
  const avg = event.avgDelayMinutes;
  switch (event.type) {
    case 'ground_stop':
      return {
        type: 'atc',
        severity: 'high',
        description: event.reason || `FAA ground stop at ${airport}`,
        minutes: avg ?? 30,
      };
    case 'ground_delay':
      return {
        type: 'atc',
        severity: avg != null && avg > 45 ? 'high' : 'medium',
        description: `FAA ground delay${event.reason ? ': ' + event.reason : ''}`,
        minutes: avg ?? 20,
      };
    case 'closure':
      return {
        type: 'atc',
        severity: 'high',
        description: event.reason || `Airport closure at ${airport}`,
        minutes: avg ?? 60,
      };
    case 'delay':
    default:
      return {
        type: 'atc',
        severity: 'medium',
        description: event.reason || `FAA delay program at ${airport}`,
        minutes: avg ?? 20,
      };
  }
}

/** Stable identity for de-duplication: same type + normalized description. */
function reasonKey(reason: DelayReason): string {
  return `${reason.type}|${reason.description.trim().toLowerCase()}`;
}

export function buildDelayCauses(
  flight: Flight,
  opts?: { nas?: ApiNasStatus | null },
): DelayCausesResult {
  const reasons: DelayReason[] = [...predictDelay(flight).delayReasons];

  const nas = opts?.nas;
  if (nas?.hasIssues) {
    for (const event of nas.events) {
      reasons.push(nasEventToReason(event, nas.airport));
    }
  }

  // De-duplicate obviously identical reasons, keeping the higher-minutes copy.
  const byKey = new Map<string, DelayReason>();
  for (const reason of reasons) {
    const key = reasonKey(reason);
    const existing = byKey.get(key);
    if (!existing || reason.minutes > existing.minutes) {
      byKey.set(key, reason);
    }
  }

  const severityRank: Record<DelaySeverity, number> = { high: 3, medium: 2, low: 1 };
  const merged = [...byKey.values()].sort(
    (a, b) => b.minutes - a.minutes || severityRank[b.severity] - severityRank[a.severity],
  );

  const top = merged[0];
  const summary = top ? `${top.description} (~${top.minutes} min)` : null;

  return { reasons: merged, summary };
}
