// Flightline Worker entry point: CORS enforcement, routing, and error handling.
// Provider secrets live only in `env` and are never echoed to responses/logs.
import type { Env } from './types';
import { resolveCorsHeaders, preflightHeaders } from './cors';
import { route, type AppDeps } from './router';
import { fetchAviationstack } from './providers/aviationstack';
import { fetchAirlabs } from './providers/airlabs';
import { fetchAdsbPosition, searchAdsbCallsign } from './providers/adsblol';
import { fetchOpenSky } from './providers/opensky';
import { fetchWeather } from './providers/weather';
import type { CacheLike } from './cache';

// Build the production dependency set, binding provider fns to env secrets and
// the real fetch + Cache API.
function buildDeps(env: Env): AppDeps {
  const now = (): number => Date.now();
  const requestId = (): string => crypto.randomUUID();
  const cache = caches.default as unknown as CacheLike;

  return {
    cache,
    now,
    requestId,
    flight: {
      fetchAviationstack: (iata, date) =>
        fetchAviationstack(iata, date, env.AVIATIONSTACK_API_KEY, fetch, Date.now()),
      fetchAirlabs: (iata, date) =>
        fetchAirlabs(iata, date, env.AIRLABS_API_KEY, fetch, Date.now()),
      fetchAdsbPosition: (icao24) => fetchAdsbPosition(icao24, fetch, Date.now()),
      searchAdsbCallsign: (callsign) => searchAdsbCallsign(callsign, fetch, Date.now()),
      fetchOpenSky: (icao24) => fetchOpenSky(icao24, fetch, Date.now()),
      now,
      requestId,
    },
    weather: (icao) => fetchWeather(icao, fetch, Date.now()),
  };
}

// Browser responses are always no-store; edge reuse is controlled by the Worker
// cache, not the browser.
function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = resolveCorsHeaders(origin, env);

    // Reject disallowed cross-origin browser requests before doing any work.
    if (cors.forbidden) {
      return jsonResponse(
        { error: 'Origin not allowed', code: 'forbidden' },
        403,
        cors.headers,
      );
    }

    // CORS preflight.
    if (request.method.toUpperCase() === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors.headers, ...preflightHeaders() },
      });
    }

    try {
      const deps = buildDeps(env);
      const result = await route(request, env, deps);
      return jsonResponse(result.body, result.status, cors.headers);
    } catch (err) {
      // Never leak internal details (which may include secrets) to clients.
      console.error('worker error', err instanceof Error ? err.message : 'unknown');
      return jsonResponse(
        { error: 'Internal error', code: 'internal_error' },
        500,
        cors.headers,
      );
    }
  },
};
