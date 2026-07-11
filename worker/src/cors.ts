// Pure, testable CORS resolution. The Worker cache (not the browser) controls
// edge reuse, so browser responses always carry `Cache-Control: no-store`
// (added by the router), while CORS is decided here.
import type { Env } from './types';

export interface CorsResolution {
  headers: Record<string, string>;
  forbidden: boolean;
}

// Allowed origins are the configured Pages origin plus an optional dev origin.
export function allowedOrigins(env: Env): string[] {
  return [env.PAGES_ORIGIN, env.DEV_ORIGIN].filter(
    (o): o is string => typeof o === 'string' && o.length > 0,
  );
}

// Resolve CORS headers for a request Origin.
//   - No Origin header (CLI / health checks) -> allowed, no ACAO emitted.
//   - Origin exactly matches an allowed origin -> reflect it.
//   - Origin present but not allowed -> forbidden (never emit `*`).
// `Vary: Origin` is always set so caches key correctly on Origin.
export function resolveCorsHeaders(origin: string | null, env: Env): CorsResolution {
  const headers: Record<string, string> = { Vary: 'Origin' };

  if (origin === null) {
    return { headers, forbidden: false };
  }

  if (allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    return { headers, forbidden: false };
  }

  return { headers, forbidden: true };
}

// Preflight-only headers. No credentials, no custom auth headers exposed.
export function preflightHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
