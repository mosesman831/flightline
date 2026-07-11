// Shared test doubles. Nothing here touches the network.
import type { CacheLike } from '../src/cache.ts';

// An in-memory Cache API stub. Stores serialized bodies + headers so responses
// can be matched repeatedly (unlike a live single-use Response body).
export interface CacheStub extends CacheLike {
  store: Map<string, { body: string; headers: [string, string][] }>;
}

export function makeCacheStub(): CacheStub {
  const store = new Map<string, { body: string; headers: [string, string][] }>();
  return {
    store,
    async match(key: string) {
      const e = store.get(key);
      if (!e) return undefined;
      return new Response(e.body, { headers: e.headers });
    },
    async put(key: string, resp: Response) {
      const body = await resp.text();
      const headers = [...resp.headers.entries()] as [string, string][];
      store.set(key, { body, headers });
    },
    async delete(key: string) {
      return store.delete(key);
    },
  };
}

// A fetch stub returning a JSON response with a given status.
export function jsonFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
}

// A fetch stub that returns different responses keyed by URL substring.
export function routedFetch(routes: Array<{ match: string; status?: number; body: unknown }>): typeof fetch {
  return (async (input: unknown) => {
    const url = typeof input === 'string' ? input : String((input as { url?: string }).url ?? input);
    for (const r of routes) {
      if (url.includes(r.match)) {
        return new Response(JSON.stringify(r.body), {
          status: r.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
}

// A fetch stub that always throws (simulates a network timeout).
export function throwingFetch(): typeof fetch {
  return (async () => {
    throw new Error('network timeout');
  }) as unknown as typeof fetch;
}

// Guard: replace globalThis.fetch so an accidental real network call fails loudly.
export function blockRealFetch(): void {
  globalThis.fetch = (async () => {
    throw new Error('real fetch is blocked in tests');
  }) as unknown as typeof fetch;
}
