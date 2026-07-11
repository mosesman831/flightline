// Main worker entry point
import type { ApiKeys } from './types';
import { getFlightStatus, getLivePosition, getAirportWeather, getProviderStatus } from './router';

interface Env {
  AVIATIONSTACK_KEY?: string;
  AIRLABS_KEY?: string;
  FLIGHTAPI_KEY?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const keys: ApiKeys = {
        aviationstack: env.AVIATIONSTACK_KEY,
        airlabs: env.AIRLABS_KEY,
        flightapi: env.FLIGHTAPI_KEY,
      };

      // GET /api/flight/:flightNumber
      const flightMatch = url.pathname.match(/^\/api\/flight\/([A-Za-z0-9]+)$/);
      if (flightMatch) {
        const flightNumber = flightMatch[1].toUpperCase();
        const data = await getFlightStatus(flightNumber, keys);
        return Response.json(data || { error: 'Flight not found' }, {
          headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=30' },
          status: data ? 200 : 404,
        });
      }

      // GET /api/position/:icao24
      const posMatch = url.pathname.match(/^\/api\/position\/([A-Za-z0-9]+)$/);
      if (posMatch) {
        const data = await getLivePosition(posMatch[1].toUpperCase());
        return Response.json(data || { error: 'Position not found' }, {
          headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=10' },
          status: data ? 200 : 404,
        });
      }

      // GET /api/weather/:icao
      const weatherMatch = url.pathname.match(/^\/api\/weather\/([A-Za-z]{4})$/);
      if (weatherMatch) {
        const data = await getAirportWeather(weatherMatch[1].toUpperCase());
        return Response.json(data, {
          headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=900' },
        });
      }

      // GET /api/providers
      if (url.pathname === '/api/providers') {
        const data = getProviderStatus(keys);
        return Response.json(data, { headers: corsHeaders });
      }

      // Health check
      if (url.pathname === '/api/health') {
        return Response.json({ status: 'ok', timestamp: new Date().toISOString() }, {
          headers: corsHeaders,
        });
      }

      return Response.json({ error: 'Not found' }, {
        status: 404,
        headers: corsHeaders,
      });
    } catch (err) {
      return Response.json(
        { error: 'Internal error', message: err instanceof Error ? err.message : 'Unknown' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
