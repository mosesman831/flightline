import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, type AppDeps } from '../src/router.ts';
import type {
  Env,
  FlightBase,
  InboundLegCore,
  LivePosition,
  NasStatusCore,
  ProviderResult,
  NormalizedFlight,
} from '../src/types.ts';
import type { WeatherCore } from '../src/providers/weather.ts';
import { makeCacheStub } from './helpers.ts';

const env: Env = {
  AVIATIONSTACK_API_KEY: 'k',
  PAGES_ORIGIN: 'https://flightline.pages.dev',
  DEV_ORIGIN: 'http://localhost:5173',
  ENVIRONMENT: 'development',
};

function baseFixture(overrides: Partial<FlightBase> = {}): FlightBase {
  return {
    iataNumber: 'BA178', flightNumber: '178', airlineIata: 'BA', airlineName: 'British Airways',
    flightIcao: 'BAW178',
    origin: { iata: 'LHR', icao: 'EGLL', name: 'Heathrow' },
    destination: { iata: 'JFK', icao: 'KJFK', name: 'JFK' },
    scheduledDeparture: '2026-07-11T13:30:00.000Z', scheduledArrival: null,
    estimatedDeparture: null, estimatedArrival: null, actualDeparture: null, actualArrival: null,
    localDepartureDate: '2026-07-11', status: 'scheduled', delayMinutes: 0,
    gate: null, terminal: null, aircraft: null, registration: null, icao24: '400abc',
    codeshare: null, statusSource: 'aviationstack', ...overrides,
  };
}

const posFixture: LivePosition = {
  icao24: '400abc', callsign: 'BAW178', latitude: 51, longitude: 0, altitudeFt: 30000,
  groundSpeedKt: 400, heading: 90, verticalRateFpm: 0, onGround: false,
  observedAt: '2026-07-11T11:59:55.000Z', stale: false, source: 'adsb.lol',
};

interface Cfg {
  av: ProviderResult<FlightBase>;
  al: ProviderResult<FlightBase>;
  adsb: ProviderResult<LivePosition>;
  callsign: { position: ProviderResult<LivePosition>; icao24: string | null };
  opensky: ProviderResult<LivePosition>;
  weather: ProviderResult<WeatherCore>;
  inbound: ProviderResult<InboundLegCore>;
  nas: ProviderResult<NasStatusCore>;
}

function makeAppDeps() {
  const nowRef = { ms: Date.parse('2026-07-11T12:00:00.000Z') };
  const cfg: Cfg = {
    av: { ok: true, data: baseFixture() },
    al: { ok: false, reason: 'unconfigured' },
    adsb: { ok: false, reason: 'no_match' },
    callsign: { position: { ok: false, reason: 'no_match' }, icao24: null },
    opensky: { ok: false, reason: 'no_match' },
    weather: { ok: false, reason: 'no_match' },
    inbound: { ok: false, reason: 'no_match' },
    nas: { ok: false, reason: 'no_match' },
  };
  const produceCount = { av: 0, inbound: 0, nas: 0 };
  const deps: AppDeps = {
    cache: makeCacheStub(),
    now: () => nowRef.ms,
    requestId: () => 'req-test',
    flight: {
      fetchAviationstack: async () => { produceCount.av++; return cfg.av; },
      fetchAirlabs: async () => cfg.al,
      fetchAdsbPosition: async () => cfg.adsb,
      searchAdsbCallsign: async () => cfg.callsign,
      fetchOpenSky: async () => cfg.opensky,
      now: () => nowRef.ms,
      requestId: () => 'req-test',
    },
    weather: async () => cfg.weather,
    inbound: async () => { produceCount.inbound++; return cfg.inbound; },
    nas: async () => { produceCount.nas++; return cfg.nas; },
  };
  return { deps, cfg, nowRef, produceCount };
}

const inboundFixture: InboundLegCore = {
  flightIata: 'BAW178', originIcao: 'EGLL', originIata: null, destinationIcao: 'KJFK',
  scheduledArrival: null, arrivalEstimated: null, arrivalActual: '2026-07-11T10:00:00.000Z',
  icao24: 'abc123', tail: null, source: 'opensky',
};

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://flightline.pages.dev${path}`, init);
}

test('POST /api/track returns a NormalizedFlight snapshot', async () => {
  const { deps } = makeAppDeps();
  const r = await route(req('/api/track', { method: 'POST', body: JSON.stringify({ airlineIata: 'ba', flightNumber: '178', date: '2026-07-11' }) }), env, deps);
  assert.equal(r.status, 200);
  const b = r.body as NormalizedFlight;
  assert.equal(b.iataNumber, 'BA178');
  assert.equal(b.canonicalKey, '2026-07-11:BA178');
  assert.equal(b.serviceDate, '2026-07-11');
  assert.equal(b.stale, false);
  assert.deepEqual(b.dataSources, ['aviationstack']);
  assert.ok(b.requestId && b.fetchedAt);
});

test('POST /api/track invalid input -> 400 with code invalid_input', async () => {
  const { deps } = makeAppDeps();
  const r = await route(req('/api/track', { method: 'POST', body: JSON.stringify({ airlineIata: 'B', flightNumber: 'x', date: 'nope' }) }), env, deps);
  assert.equal(r.status, 400);
  assert.equal((r.body as any).code, 'invalid_input');
});

test('POST /api/track with non-JSON body -> 400', async () => {
  const { deps } = makeAppDeps();
  const r = await route(req('/api/track', { method: 'POST', body: 'not json' }), env, deps);
  assert.equal(r.status, 400);
  assert.equal((r.body as any).code, 'invalid_input');
});

test('/api/track wrong method -> 405', async () => {
  const { deps } = makeAppDeps();
  const r = await route(req('/api/track', { method: 'GET' }), env, deps);
  assert.equal(r.status, 405);
});

test('error mapping: 429 / 404 / 502 with proper codes', async () => {
  for (const [c, status, code] of [
    [{ av: { ok: false, reason: 'rate_limited' }, al: { ok: false, reason: 'rate_limited' } }, 429, 'rate_limited'],
    [{ av: { ok: false, reason: 'no_match' }, al: { ok: false, reason: 'unconfigured' } }, 404, 'not_found'],
    [{ av: { ok: false, reason: 'error' }, al: { ok: false, reason: 'auth' } }, 502, 'providers_unavailable'],
  ] as const) {
    const { deps, cfg } = makeAppDeps();
    Object.assign(cfg, c);
    const r = await route(req('/api/track', { method: 'POST', body: JSON.stringify({ airlineIata: 'BA', flightNumber: '178', date: '2026-07-11' }) }), env, deps);
    assert.equal(r.status, status);
    assert.equal((r.body as any).code, code);
  }
});

test('GET /api/flight requires a date query', async () => {
  const { deps } = makeAppDeps();
  const r = await route(req('/api/flight/BA178'), env, deps);
  assert.equal(r.status, 400);
  assert.equal((r.body as any).code, 'invalid_input');
});

test('GET /api/flight caches and separates by service date', async () => {
  const { deps, produceCount } = makeAppDeps();
  await route(req('/api/flight/BA178?date=2026-07-11'), env, deps);
  await route(req('/api/flight/BA178?date=2026-07-11'), env, deps); // cache hit
  assert.equal(produceCount.av, 1);
  await route(req('/api/flight/BA178?date=2026-07-12'), env, deps); // different date -> miss
  assert.equal(produceCount.av, 2);
  // Different service dates are stored under different keys.
  assert.ok([...(deps.cache as any).store.keys()].some((k: string) => k.includes('2026-07-11')));
  assert.ok([...(deps.cache as any).store.keys()].some((k: string) => k.includes('2026-07-12')));
});

test('confirmed not-found is negative-cached (30s)', async () => {
  const { deps, cfg, produceCount } = makeAppDeps();
  cfg.av = { ok: false, reason: 'no_match' };
  cfg.al = { ok: false, reason: 'unconfigured' };
  const r1 = await route(req('/api/flight/BA999?date=2026-07-11'), env, deps);
  assert.equal(r1.status, 404);
  const r2 = await route(req('/api/flight/BA999?date=2026-07-11'), env, deps); // served from negative cache
  assert.equal(r2.status, 404);
  assert.equal(produceCount.av, 1);
});

test('stale-if-error: last good copy served with stale=true after upstream failure', async () => {
  const { deps, cfg, nowRef } = makeAppDeps();
  const r1 = await route(req('/api/flight/BA178?date=2026-07-11'), env, deps);
  assert.equal(r1.status, 200);
  assert.equal((r1.body as NormalizedFlight).stale, false);

  // Upstream now fails; advance 60s (> 45s logical TTL, < 15min stale window).
  cfg.av = { ok: false, reason: 'error' };
  cfg.al = { ok: false, reason: 'error' };
  nowRef.ms += 60_000;
  const r2 = await route(req('/api/flight/BA178?date=2026-07-11'), env, deps);
  assert.equal(r2.status, 200);
  assert.equal((r2.body as NormalizedFlight).stale, true);

  // Beyond the 15-minute stale window -> propagate the error.
  nowRef.ms += 16 * 60_000;
  const r3 = await route(req('/api/flight/BA178?date=2026-07-11'), env, deps);
  assert.equal(r3.status, 502);
});

test('GET /api/position/:icao24 returns an enveloped position; 404 when absent', async () => {
  const { deps, cfg } = makeAppDeps();
  cfg.adsb = { ok: true, data: posFixture };
  const r = await route(req('/api/position/400abc'), env, deps);
  assert.equal(r.status, 200);
  assert.equal((r.body as any).position.icao24, '400abc');
  assert.equal((r.body as any).stale, false);
  assert.deepEqual((r.body as any).dataSources, ['adsb.lol']);

  const bad = await route(req('/api/position/zzzzzz'), env, deps);
  assert.equal(bad.status, 400);

  const { deps: d2 } = makeAppDeps();
  const none = await route(req('/api/position/400abc'), env, d2);
  assert.equal(none.status, 404);
});

test('GET /api/position/callsign uses adsb search then OpenSky', async () => {
  const { deps, cfg } = makeAppDeps();
  cfg.callsign = { position: { ok: false, reason: 'unusable' }, icao24: 'abc123' };
  cfg.opensky = { ok: true, data: { ...posFixture, icao24: 'abc123', source: 'opensky' } };
  const r = await route(req('/api/position/callsign/BAW178'), env, deps);
  assert.equal(r.status, 200);
  assert.equal((r.body as any).position.source, 'opensky');
});

test('GET /api/weather/:icao returns normalized weather; 400 for bad code', async () => {
  const { deps, cfg } = makeAppDeps();
  cfg.weather = { ok: true, data: { airport: 'EGLL', metar: 'EGLL 111200Z', taf: 'TAF', windSpeedKts: 10, windGustKts: 0, visibilityKm: 16, temperatureC: 15, observedAt: '2026-07-11T12:00:00.000Z' } };
  const r = await route(req('/api/weather/EGLL'), env, deps);
  assert.equal(r.status, 200);
  const b = r.body as any;
  assert.equal(b.airport, 'EGLL');
  assert.equal(b.metar, 'EGLL 111200Z');
  assert.equal(b.stale, false);
  assert.ok(b.requestId && b.fetchedAt);

  assert.equal((await route(req('/api/weather/LHR'), env, deps)).status, 400);
});

test('GET /api/providers reports config + unknown until observed (no false healthy)', async () => {
  const { deps } = makeAppDeps();
  const r = await route(req('/api/providers'), env, deps);
  assert.equal(r.status, 200);
  const reports = r.body as any[];
  const av = reports.find((p) => p.key === 'aviationstack');
  const al = reports.find((p) => p.key === 'airlabs');
  assert.equal(av.configured, true);
  assert.equal(al.configured, false);
  for (const p of reports) assert.equal(p.lastOutcome, 'unknown');
});

test('GET /api/health does not probe upstreams', async () => {
  const { deps } = makeAppDeps();
  const r = await route(req('/api/health'), env, deps);
  assert.equal(r.status, 200);
  const b = r.body as any;
  assert.equal(b.status, 'ok');
  assert.ok(b.version);
  assert.ok(b.timestamp);
});

const BEFORE = '2026-07-11T12:00:00.000Z';

test('GET /api/inbound returns an enveloped inbound leg', async () => {
  const { deps, cfg } = makeAppDeps();
  cfg.inbound = { ok: true, data: inboundFixture };
  const r = await route(req(`/api/inbound/abc123?airport=KJFK&before=${BEFORE}`), env, deps);
  assert.equal(r.status, 200);
  const b = r.body as any;
  assert.equal(b.found, true);
  assert.equal(b.flightIata, 'BAW178');
  assert.equal(b.originIcao, 'EGLL');
  assert.equal(b.destinationIcao, 'KJFK');
  assert.equal(b.arrivalActual, '2026-07-11T10:00:00.000Z');
  assert.equal(b.icao24, 'abc123');
  assert.equal(b.stale, false);
  assert.deepEqual(b.dataSources, ['opensky']);
  assert.equal(b.source, 'opensky');
  assert.ok(b.requestId && b.fetchedAt);
});

test('GET /api/inbound caches success (~300s) and separates by airport', async () => {
  const { deps, cfg, produceCount } = makeAppDeps();
  cfg.inbound = { ok: true, data: inboundFixture };
  await route(req(`/api/inbound/abc123?airport=KJFK&before=${BEFORE}`), env, deps);
  await route(req(`/api/inbound/abc123?airport=KJFK&before=${BEFORE}`), env, deps); // cache hit
  assert.equal(produceCount.inbound, 1);
  await route(req(`/api/inbound/abc123?airport=KLAX&before=${BEFORE}`), env, deps); // different airport
  assert.equal(produceCount.inbound, 2);
  assert.ok([...(deps.cache as any).store.keys()].some((k: string) => k.includes('KJFK')));
  assert.ok([...(deps.cache as any).store.keys()].some((k: string) => k.includes('KLAX')));
});

test('GET /api/inbound empty -> 404 negative-cached (60s)', async () => {
  const { deps, cfg, produceCount } = makeAppDeps();
  cfg.inbound = { ok: false, reason: 'no_match' };
  const r1 = await route(req(`/api/inbound/abc123?airport=KJFK&before=${BEFORE}`), env, deps);
  assert.equal(r1.status, 404);
  assert.equal((r1.body as any).code, 'not_found');
  const r2 = await route(req(`/api/inbound/abc123?airport=KJFK&before=${BEFORE}`), env, deps); // negative cache
  assert.equal(r2.status, 404);
  assert.equal(produceCount.inbound, 1);
});

test('GET /api/inbound rate-limit -> 429; upstream error -> 502 (not cached)', async () => {
  const { deps, cfg, produceCount } = makeAppDeps();
  cfg.inbound = { ok: false, reason: 'rate_limited' };
  assert.equal((await route(req(`/api/inbound/abc123?before=${BEFORE}`), env, deps)).status, 429);
  cfg.inbound = { ok: false, reason: 'error' };
  const r = await route(req(`/api/inbound/abc123?before=${BEFORE}`), env, deps);
  assert.equal(r.status, 502);
  // Failures are never cached: each call re-invokes the provider.
  await route(req(`/api/inbound/abc123?before=${BEFORE}`), env, deps);
  assert.equal(produceCount.inbound, 3);
});

test('GET /api/inbound validates icao24 and requires before', async () => {
  const { deps } = makeAppDeps();
  assert.equal((await route(req(`/api/inbound/zzz?before=${BEFORE}`), env, deps)).status, 400);
  const noBefore = await route(req('/api/inbound/abc123'), env, deps);
  assert.equal(noBefore.status, 400);
  assert.equal((noBefore.body as any).code, 'invalid_input');
  assert.equal((await route(req('/api/inbound/abc123?before=not-a-date'), env, deps)).status, 400);
});

test('GET /api/nas returns enveloped status with events', async () => {
  const { deps, cfg } = makeAppDeps();
  cfg.nas = {
    ok: true,
    data: {
      airport: 'EWR', hasIssues: true,
      events: [{ type: 'ground_stop', reason: 'weather', avgDelayMinutes: null, scope: null, endTime: null }],
    },
  };
  const r = await route(req('/api/nas/EWR'), env, deps);
  assert.equal(r.status, 200);
  const b = r.body as any;
  assert.equal(b.airport, 'EWR');
  assert.equal(b.hasIssues, true);
  assert.equal(b.events[0].type, 'ground_stop');
  assert.equal(b.stale, false);
  assert.equal(b.source, 'faa');
  assert.deepEqual(b.dataSources, ['faa']);
  assert.ok(b.requestId && b.fetchedAt);
});

test('GET /api/nas no-advisory airport -> 200 hasIssues:false', async () => {
  const { deps, cfg } = makeAppDeps();
  cfg.nas = { ok: true, data: { airport: 'ATL', hasIssues: false, events: [] } };
  const r = await route(req('/api/nas/atl'), env, deps);
  assert.equal(r.status, 200);
  assert.equal((r.body as any).hasIssues, false);
  assert.deepEqual((r.body as any).events, []);
});

test('GET /api/nas validates 3-letter IATA; upstream error -> 502', async () => {
  const { deps, cfg } = makeAppDeps();
  assert.equal((await route(req('/api/nas/EWRX'), env, deps)).status, 400);
  assert.equal((await route(req('/api/nas/12'), env, deps)).status, 400);
  cfg.nas = { ok: false, reason: 'error' };
  assert.equal((await route(req('/api/nas/EWR'), env, deps)).status, 502);
});

test('unknown route -> 404 not_found', async () => {
  const { deps } = makeAppDeps();
  const r = await route(req('/api/nope'), env, deps);
  assert.equal(r.status, 404);
  assert.equal((r.body as any).code, 'not_found');
});
