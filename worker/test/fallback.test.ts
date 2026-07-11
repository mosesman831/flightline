import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSchedule,
  resolveLivePosition,
  getFlightSnapshot,
  type FlightServiceDeps,
} from '../src/flightService.ts';
import type { FlightBase, LivePosition, ProviderResult } from '../src/types.ts';

const NOW = Date.parse('2026-07-11T12:00:00.000Z');

function baseFixture(overrides: Partial<FlightBase> = {}): FlightBase {
  return {
    iataNumber: 'BA178',
    flightNumber: '178',
    airlineIata: 'BA',
    airlineName: 'British Airways',
    flightIcao: 'BAW178',
    origin: { iata: 'LHR', icao: 'EGLL', name: 'Heathrow' },
    destination: { iata: 'JFK', icao: 'KJFK', name: 'JFK' },
    scheduledDeparture: '2026-07-11T14:30:00+01:00',
    scheduledArrival: null,
    estimatedDeparture: null,
    estimatedArrival: null,
    actualDeparture: null,
    actualArrival: null,
    localDepartureDate: '2026-07-11',
    status: 'scheduled',
    delayMinutes: 0,
    gate: null,
    terminal: null,
    aircraft: null,
    registration: null,
    icao24: '400abc',
    codeshare: null,
    statusSource: 'aviationstack',
    ...overrides,
  };
}

const posFixture: LivePosition = {
  icao24: '400abc', callsign: 'BAW178', latitude: 51, longitude: 0,
  altitudeFt: 30000, groundSpeedKt: 400, heading: 90, verticalRateFpm: 0,
  onGround: false, observedAt: '2026-07-11T11:59:55.000Z', stale: false, source: 'adsb.lol',
};

interface Calls { av: number; al: number; adsb: string[]; callsign: string[]; opensky: string[] }

function makeDeps(
  cfg: {
    av?: ProviderResult<FlightBase>;
    al?: ProviderResult<FlightBase>;
    adsb?: ProviderResult<LivePosition>;
    callsign?: { position: ProviderResult<LivePosition>; icao24: string | null };
    opensky?: ProviderResult<LivePosition>;
  },
): { deps: FlightServiceDeps; calls: Calls } {
  const calls: Calls = { av: 0, al: 0, adsb: [], callsign: [], opensky: [] };
  const deps: FlightServiceDeps = {
    fetchAviationstack: async () => { calls.av++; return cfg.av ?? { ok: false, reason: 'unconfigured' }; },
    fetchAirlabs: async () => { calls.al++; return cfg.al ?? { ok: false, reason: 'unconfigured' }; },
    fetchAdsbPosition: async (icao) => { calls.adsb.push(icao); return cfg.adsb ?? { ok: false, reason: 'no_match' }; },
    searchAdsbCallsign: async (cs) => { calls.callsign.push(cs); return cfg.callsign ?? { position: { ok: false, reason: 'no_match' }, icao24: null }; },
    fetchOpenSky: async (icao) => { calls.opensky.push(icao); return cfg.opensky ?? { ok: false, reason: 'no_match' }; },
    now: () => NOW,
    requestId: () => 'test-req',
  };
  return { deps, calls };
}

test('aviationstack is queried first; airlabs is skipped when it succeeds', async () => {
  const { deps, calls } = makeDeps({ av: { ok: true, data: baseFixture() } });
  const r = await resolveSchedule('BA178', '2026-07-11', deps);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.source, 'aviationstack');
  assert.equal(calls.av, 1);
  assert.equal(calls.al, 0);
});

test('airlabs is queried on each aviationstack failure mode', async () => {
  for (const reason of ['unconfigured', 'no_match', 'rate_limited', 'auth', 'unusable', 'error'] as const) {
    const { deps, calls } = makeDeps({
      av: { ok: false, reason },
      al: { ok: true, data: baseFixture({ statusSource: 'airlabs' }) },
    });
    const r = await resolveSchedule('BA178', '2026-07-11', deps);
    assert.equal(r.ok, true, `reason=${reason}`);
    if (r.ok) assert.equal(r.source, 'airlabs');
    assert.equal(calls.al, 1, `airlabs should be called when av=${reason}`);
  }
});

test('all providers rate-limited -> 429', async () => {
  const { deps } = makeDeps({ av: { ok: false, reason: 'rate_limited' }, al: { ok: false, reason: 'rate_limited' } });
  const r = await resolveSchedule('BA178', '2026-07-11', deps);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.httpStatus, 429); assert.equal(r.code, 'rate_limited'); }
});

test('provider responded but no date match -> 404', async () => {
  const { deps } = makeDeps({ av: { ok: false, reason: 'no_match' }, al: { ok: false, reason: 'unconfigured' } });
  const r = await resolveSchedule('BA178', '2026-07-11', deps);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.httpStatus, 404); assert.equal(r.code, 'not_found'); }
});

test('errors/auth with no data and no rate-limit -> 502', async () => {
  const { deps } = makeDeps({ av: { ok: false, reason: 'error' }, al: { ok: false, reason: 'auth' } });
  const r = await resolveSchedule('BA178', '2026-07-11', deps);
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.httpStatus, 502); assert.equal(r.code, 'providers_unavailable'); }
});

test('rate-limit takes precedence over a no_match from the other provider', async () => {
  const { deps } = makeDeps({ av: { ok: false, reason: 'rate_limited' }, al: { ok: false, reason: 'no_match' } });
  const r = await resolveSchedule('BA178', '2026-07-11', deps);
  if (!r.ok) assert.equal(r.httpStatus, 429);
});

test('position: adsb.lol by known ICAO24; OpenSky skipped when adsb has a position', async () => {
  const { deps, calls } = makeDeps({ adsb: { ok: true, data: posFixture } });
  const r = await resolveLivePosition(baseFixture(), deps);
  assert.equal(r.source, 'adsb.lol');
  assert.deepEqual(calls.adsb, ['400abc']);
  assert.equal(calls.opensky.length, 0);
});

test('position: OpenSky follows adsb.lol only when ICAO24 known', async () => {
  const { deps, calls } = makeDeps({
    adsb: { ok: false, reason: 'unusable' },
    opensky: { ok: true, data: { ...posFixture, source: 'opensky' } },
  });
  const r = await resolveLivePosition(baseFixture({ icao24: '400abc' }), deps);
  assert.equal(r.source, 'opensky');
  assert.deepEqual(calls.opensky, ['400abc']);
});

test('position: no ICAO24 uses callsign search, and discovered hex enables OpenSky', async () => {
  const { deps, calls } = makeDeps({
    callsign: { position: { ok: false, reason: 'unusable' }, icao24: 'abc123' },
    opensky: { ok: true, data: { ...posFixture, icao24: 'abc123', source: 'opensky' } },
  });
  const r = await resolveLivePosition(baseFixture({ icao24: null, flightIcao: 'BAW178' }), deps);
  assert.deepEqual(calls.callsign, ['BAW178']);
  assert.deepEqual(calls.opensky, ['abc123']);
  assert.equal(r.source, 'opensky');
});

test('position: no ICAO24 and no callsign result -> OpenSky never called', async () => {
  const { deps, calls } = makeDeps({});
  const r = await resolveLivePosition(baseFixture({ icao24: null, flightIcao: null }), deps);
  assert.equal(r.position, null);
  assert.equal(calls.opensky.length, 0);
  assert.equal(calls.adsb.length, 0);
});

test('getFlightSnapshot builds envelope with dataSources, canonicalKey, stale=false', async () => {
  const { deps } = makeDeps({ av: { ok: true, data: baseFixture() }, adsb: { ok: true, data: posFixture } });
  const r = await getFlightSnapshot('BA178', '2026-07-11', deps);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.flight.canonicalKey, '2026-07-11:BA178');
    assert.equal(r.flight.serviceDate, '2026-07-11');
    assert.equal(r.flight.stale, false);
    assert.deepEqual(r.flight.dataSources, ['aviationstack', 'adsb.lol']);
    assert.equal(r.flight.positionSource, 'adsb.lol');
    assert.equal(r.flight.livePosition?.icao24, '400abc');
  }
});
