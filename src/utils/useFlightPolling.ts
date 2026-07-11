import { useEffect } from 'react';
import type { Flight } from '../types/flight';
import { refreshAllDue, shouldPoll } from './refresh';

/**
 * Visibility-aware status polling for all active flights.
 *
 * - Runs only while the document is visible.
 * - Each flight refreshes on its own cadence (60s inside the T-3h window,
 *   5 min for scheduled flights more than three hours out) via the shared
 *   refresh pipeline; terminal/archived/demo flights are skipped.
 * - Triggers an immediate due-refresh on reconnect and on window focus.
 */
export function useFlightPolling(flights: Flight[]) {
  const hasPollable = flights.some(shouldPoll);

  useEffect(() => {
    if (!hasPollable) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') return;
      void refreshAllDue();
    };

    // Kick once shortly after mount, then poll on a coarse cadence; each flight's
    // own interval gates whether it actually refreshes.
    const initial = setTimeout(tick, 1500);
    const interval = setInterval(tick, 20_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshAllDue();
    };
    const onOnline = () => void refreshAllDue({ force: true });
    const onFocus = () => void refreshAllDue();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
    };
  }, [hasPollable]);
}
