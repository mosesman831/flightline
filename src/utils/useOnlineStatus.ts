import { useEffect, useState } from 'react';

/**
 * Subscribe to the browser's connectivity status.
 *
 * Listens to the window `online` / `offline` events and returns the current
 * `navigator.onLine` value. SSR-safe: when `navigator` is undefined (e.g.
 * server render) it defaults to `true` so content is not gated as offline.
 *
 * @returns `true` when the browser reports it is online, otherwise `false`.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(getInitialOnline);

  useEffect(() => {
    // Nothing to subscribe to outside the browser.
    if (typeof window === 'undefined') return;

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    // Sync once on mount in case status changed before listeners attached.
    setOnline(getInitialOnline());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

/** Read `navigator.onLine`, defaulting to `true` when `navigator` is absent. */
function getInitialOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Determine whether cached flight data is stale.
 *
 * Per spec, a cached flight is stale when its last successful status refresh
 * exceeds twice its normal polling interval. Also treats a missing or invalid
 * timestamp as stale.
 *
 * @param lastLiveSuccessAt ISO timestamp (or parseable date string) of the last
 *   successful live refresh, or `null` / `undefined` when never refreshed.
 * @param normalIntervalMs The flight's normal refresh interval, in milliseconds.
 * @returns `true` when the data should be considered stale.
 */
export function isStale(
  lastLiveSuccessAt: string | null | undefined,
  normalIntervalMs: number
): boolean {
  if (!lastLiveSuccessAt) return true;

  const lastMs = new Date(lastLiveSuccessAt).getTime();
  if (Number.isNaN(lastMs)) return true;

  return Date.now() - lastMs > normalIntervalMs * 2;
}
