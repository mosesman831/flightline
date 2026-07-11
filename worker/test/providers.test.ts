import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAviationstack, mapAviationstackFlight } from '../src/providers/aviationstack.ts';
import { fetchAirlabs, mapAirlabsFlight } from '../src/providers/airlabs.ts';
import { fetchAdsbPosition, searchAdsbCallsign, mapAdsbAircraft } from '../src/providers/adsblol.ts';
import { fetchOpenSky, mapOpenSkyState } from '../src/providers/opensky.ts';
import { fetchWeather, mapWeather } from '../src/providers/weather.ts';
import { jsonFetch, routedFetch, throwingFetch, blockRealFetch } from './helpers.ts';

const NOW = Date.parse('2026-07-11T12:00:00.000Z');
const badJsonFetch: typeof fetch = (async () => new Response('<<notjson>>', { status: 200 })) as unknown as typeof fetch;

before(() => blockRealFetch());

// --- Aviationstack ----------------------------------------------------------

const avRecord = {
  flight_date: '2026-07-11',
  flight_status: 'active',
  departure: { airport: 'Heathrow', iata: 'LHR', icao: 'EGLL', terminal: '5', gate: 'A1', scheduled: '2026-07-11T14:30:00+01:00', delay: 0 },
  arrival: { airport: 'JFK', iata: 'JFK', icao: 'KJFK', terminal: '7', scheduled: '2026-07-11T17:30:00-04:00' },
  airline: { name: 'British Airways', iata: 'BA' },
  flight: { number: '178', iata: 'BA178', icao: 'BAW178' },
  aircraft: { registration: 'G-STBA', iata: '777', icao24: '400ABC' },
};

test('aviationstack mapper handles zero delay and normalizes fields', () => {
  const base = mapAviationstackFlight(avRecord, 'BA178');
  assert.ok(base);
  assert.equal(base!.status, 'active');
  assert.equal(base!.delayMinutes, 0); // zero preserved
  assert.equal(base!.flightIcao, 'BAW178');
  assert.equal(base!.icao24, '400abc');
  assert.equal(base!.gate, 'A1');
  assert.equal(base!.scheduledDeparture, '2026-07-11T14:30:00+01:00');
  assert.equal(base!.localDepartureDate, '2026-07-11');
});

test('aviationstack fetch: ok on matching date', async () => {
  const r = await fetchAviationstack('BA178', '2026-07-11', 'k', jsonFetch(200, { data: [avRecord] }), NOW);
  assert.equal(r.ok, true);
});

test('aviationstack fetch: date mismatch -> no_match', async () => {
  const r = await fetchAviationstack('BA178', '2026-07-12', 'k', jsonFetch(200, { data: [avRecord] }), NOW);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'no_match');
});

test('aviationstack fetch: unconfigured / 401 / 429 / 404 / timeout / malformed', async () => {
  assert.equal((await fetchAviationstack('BA178', '2026-07-11', undefined, jsonFetch(200, {}), NOW) as any).reason, 'unconfigured');
  assert.equal((await fetchAviationstack('BA178', '2026-07-11', 'k', jsonFetch(401, {}), NOW) as any).reason, 'auth');
  assert.equal((await fetchAviationstack('BA178', '2026-07-11', 'k', jsonFetch(429, {}), NOW) as any).reason, 'rate_limited');
  assert.equal((await fetchAviationstack('BA178', '2026-07-11', 'k', jsonFetch(404, {}), NOW) as any).reason, 'error');
  assert.equal((await fetchAviationstack('BA178', '2026-07-11', 'k', throwingFetch(), NOW) as any).reason, 'error');
  assert.equal((await fetchAviationstack('BA178', '2026-07-11', 'k', badJsonFetch, NOW) as any).reason, 'error');
  assert.equal((await fetchAviationstack('BA178', '2026-07-11', 'k', jsonFetch(200, { data: [] }), NOW) as any).reason, 'no_match');
});

// --- AirLabs ----------------------------------------------------------------

const alRecord = {
  flight_iata: 'BA178', flight_number: '178', flight_icao: 'BAW178',
  airline_iata: 'BA', airline_name: 'British Airways',
  dep_iata: 'LHR', dep_icao: 'EGLL', dep_time: '2026-07-11 14:30', dep_time_utc: '2026-07-11 13:30',
  arr_iata: 'JFK', arr_time_utc: '2026-07-11 21:30',
  status: 'en-route', hex: '400ABC', reg_number: 'G-STBA', aircraft_icao: 'B77W',
  delayed: 0, dep_gate: 'A1', dep_terminal: '5',
};

test('airlabs mapper prefers *_utc (Z) and derives local date from dep_time', () => {
  const base = mapAirlabsFlight(alRecord, 'BA178');
  assert.ok(base);
  assert.equal(base!.status, 'active');
  assert.equal(base!.scheduledDeparture, '2026-07-11T13:30:00.000Z');
  assert.equal(base!.localDepartureDate, '2026-07-11');
  assert.equal(base!.delayMinutes, 0);
  assert.equal(base!.icao24, '400abc');
});

test('airlabs fetch: ok / unknown-flight / auth / rate limit', async () => {
  assert.equal((await fetchAirlabs('BA178', '2026-07-11', 'k', jsonFetch(200, { response: alRecord }), NOW)).ok, true);
  assert.equal((await fetchAirlabs('BA178', '2026-07-11', 'k', jsonFetch(200, { error: { key: 'Unknown flight' } }), NOW) as any).reason, 'no_match');
  assert.equal((await fetchAirlabs('BA178', '2026-07-11', 'k', jsonFetch(200, { error: { message: 'wrong api_key' } }), NOW) as any).reason, 'auth');
  assert.equal((await fetchAirlabs('BA178', '2026-07-11', 'k', jsonFetch(429, {}), NOW) as any).reason, 'rate_limited');
  assert.equal((await fetchAirlabs('BA178', '2026-07-11', undefined, jsonFetch(200, {}), NOW) as any).reason, 'unconfigured');
  assert.equal((await fetchAirlabs('BA178', '2026-07-12', 'k', jsonFetch(200, { response: alRecord }), NOW) as any).reason, 'no_match');
});

// --- adsb.lol ---------------------------------------------------------------

test('adsb mapper: zero vertical rate valid, ground handling, staleness', () => {
  const flying = mapAdsbAircraft({ hex: '400abc', flight: 'BAW178 ', lat: 51.5, lon: -0.4, alt_baro: 35000, gs: 450, track: 270, baro_rate: 0, seen: 5 }, NOW);
  assert.ok(flying);
  assert.equal(flying!.altitudeFt, 35000);
  assert.equal(flying!.verticalRateFpm, 0);
  assert.equal(flying!.groundSpeedKt, 450);
  assert.equal(flying!.callsign, 'BAW178');
  assert.equal(flying!.onGround, false);
  assert.equal(flying!.stale, false);
  assert.equal(flying!.source, 'adsb.lol');

  const grounded = mapAdsbAircraft({ hex: '400abc', lat: 51.5, lon: -0.4, alt_baro: 'ground', seen: 2 }, NOW);
  assert.equal(grounded!.onGround, true);
  assert.equal(grounded!.altitudeFt, 0);

  const old = mapAdsbAircraft({ hex: '400abc', lat: 51.5, lon: -0.4, seen: 120 }, NOW);
  assert.equal(old!.stale, true);

  assert.equal(mapAdsbAircraft({ hex: '400abc', seen: 1 }, NOW), null); // no coords -> unusable
});

test('adsb fetch position: ok / unusable / no_match / rate limit', async () => {
  const okFetch = jsonFetch(200, { ac: [{ hex: '400abc', lat: 51, lon: 0, gs: 400, track: 90, alt_baro: 30000, seen: 3 }] });
  assert.equal((await fetchAdsbPosition('400abc', okFetch, NOW)).ok, true);
  assert.equal((await fetchAdsbPosition('400abc', jsonFetch(200, { ac: [{ hex: '400abc', seen: 1 }] }), NOW) as any).reason, 'unusable');
  assert.equal((await fetchAdsbPosition('400abc', jsonFetch(200, { ac: [] }), NOW) as any).reason, 'no_match');
  assert.equal((await fetchAdsbPosition('400abc', jsonFetch(429, {}), NOW) as any).reason, 'rate_limited');
  assert.equal((await fetchAdsbPosition('400abc', throwingFetch(), NOW) as any).reason, 'error');
});

test('adsb callsign search returns icao24 even without a usable position', async () => {
  const noCoords = jsonFetch(200, { ac: [{ hex: '400abc', flight: 'BAW178', seen: 1 }] });
  const r = await searchAdsbCallsign('BAW178', noCoords, NOW);
  assert.equal(r.position.ok, false);
  assert.equal(r.icao24, '400abc');

  const withPos = jsonFetch(200, { ac: [{ hex: '400abc', flight: 'BAW178', lat: 1, lon: 1, seen: 1 }] });
  const r2 = await searchAdsbCallsign('BAW178', withPos, NOW);
  assert.equal(r2.position.ok, true);
});

// --- OpenSky ----------------------------------------------------------------

test('opensky mapper converts SI units (m/s->kt, m->ft, m/s->fpm), zero valid', () => {
  const epoch = NOW / 1000;
  const s = ['400abc', 'BAW178  ', 'UK', epoch, epoch, -0.4, 51.5, 1000, false, 100, 270, 0];
  const pos = mapOpenSkyState(s, NOW);
  assert.ok(pos);
  assert.ok(Math.abs((pos!.groundSpeedKt as number) - 194.384) < 1e-6);
  assert.ok(Math.abs((pos!.altitudeFt as number) - 3280.84) < 1e-6);
  assert.equal(pos!.verticalRateFpm, 0);
  assert.equal(pos!.heading, 270);
  assert.equal(pos!.callsign, 'BAW178');
  assert.equal(pos!.source, 'opensky');
  assert.equal(pos!.stale, false);

  assert.equal(mapOpenSkyState(['400abc', '', '', epoch, epoch, null, null], NOW), null); // no coords
});

test('opensky fetch: ok / no_match / rate limit / timeout', async () => {
  const epoch = NOW / 1000;
  const okFetch = jsonFetch(200, { states: [['400abc', 'BAW178', 'UK', epoch, epoch, -0.4, 51.5, 1000, false, 100, 270, 0]] });
  assert.equal((await fetchOpenSky('400abc', okFetch, NOW)).ok, true);
  assert.equal((await fetchOpenSky('400abc', jsonFetch(200, { states: [] }), NOW) as any).reason, 'no_match');
  assert.equal((await fetchOpenSky('400abc', jsonFetch(200, { states: null }), NOW) as any).reason, 'no_match');
  assert.equal((await fetchOpenSky('400abc', jsonFetch(429, {}), NOW) as any).reason, 'rate_limited');
  assert.equal((await fetchOpenSky('400abc', throwingFetch(), NOW) as any).reason, 'error');
});

// --- Weather ----------------------------------------------------------------

test('weather mapper: statute miles -> km, zero gust valid', () => {
  const w = mapWeather('EGLL', { rawOb: 'EGLL 111200Z', wspd: 10, wgst: 0, visib: '10+', temp: 15, obsTime: NOW / 1000 }, 'TAF EGLL', NOW);
  assert.equal(w.windSpeedKts, 10);
  assert.equal(w.windGustKts, 0);
  assert.ok(Math.abs((w.visibilityKm as number) - 16.0934) < 1e-6);
  assert.equal(w.temperatureC, 15);
  assert.equal(w.metar, 'EGLL 111200Z');
  assert.equal(w.taf, 'TAF EGLL');
});

test('weather fetch: ok combines METAR + TAF; missing both -> no_match', async () => {
  const good = routedFetch([
    { match: 'metar', body: [{ rawOb: 'EGLL 111200Z', wspd: 10, temp: 15, visib: 6, obsTime: NOW / 1000 }] },
    { match: 'taf', body: [{ rawTAF: 'TAF EGLL' }] },
  ]);
  const r = await fetchWeather('EGLL', good, NOW);
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.data.metar, 'EGLL 111200Z'); assert.equal(r.data.taf, 'TAF EGLL'); }

  const empty = routedFetch([{ match: 'metar', body: [] }, { match: 'taf', body: [] }]);
  assert.equal((await fetchWeather('ZZZZ', empty, NOW) as any).reason, 'no_match');
});
