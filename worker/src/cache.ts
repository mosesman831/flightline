// In-memory cache using Cloudflare Workers KV or just in-memory Map
// For MVP, use in-memory Map with TTL
import type { CacheEntry } from './types';

const cache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, cachedAt: Date.now(), ttl: ttlMs } as CacheEntry<T>);
}

// TTL presets (in ms)
export const TTL = {
  FLIGHT_STATUS: 60_000,      // 1 min — status changes often
  AIRPORT_DELAY: 300_000,     // 5 min — delays update less frequently
  WEATHER: 900_000,           // 15 min — weather doesn't change fast
  LIVE_POSITION: 10_000,      // 10 sec — position is real-time
  AIRLINE_DATA: 86_400_000,   // 24 hr — airline info rarely changes
  AIRPORT_DATA: 86_400_000,   // 24 hr — airport info rarely changes
} as const;
