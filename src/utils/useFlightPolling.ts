import { useEffect, useRef, useCallback } from 'react';
import { enrichFlightWithLiveData } from './flightData';
import { saveFlight, notifyFlightsChanged } from '../store/flightStore';
import type { Flight } from '../types/flight';

export function useFlightPolling(
  flights: Flight[],
  intervalMs: number = 60_000 // 1 minute default
) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    for (const flight of flights) {
      if (flight.isDemo || flight.archived) continue;
      try {
        const enriched = await enrichFlightWithLiveData(flight);
        // Only save if something changed
        if (
          enriched.gate !== flight.gate ||
          enriched.terminal !== flight.terminal ||
          enriched.status !== flight.status ||
          enriched.delayMinutes !== flight.delayMinutes
        ) {
          await saveFlight(enriched);
        }
      } catch {
        // Skip on error
      }
    }
    notifyFlightsChanged();
  }, [flights]);

  useEffect(() => {
    // Initial refresh after 2 seconds
    const timeout = setTimeout(refresh, 2000);

    // Then poll at interval
    intervalRef.current = setInterval(refresh, intervalMs);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, intervalMs]);
}
