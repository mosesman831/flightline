import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  statusTtlSeconds,
  buildStatusKey,
  buildPositionKey,
  buildWeatherKey,
  readCached,
  writeCached,
  POSITION_TTL_SECONDS,
  WEATHER_TTL_SECONDS,
  NOT_FOUND_TTL_SECONDS,
  STATUS_PHYSICAL_TTL_SECONDS,
} from '../src/cache.ts';
import { makeCacheStub } from './helpers.ts';

const NOW = Date.parse('2026-07-11T12:00:00.000Z');

test('statusTtlSeconds: active/boarding/delayed = 45s', () => {
  assert.equal(statusTtlSeconds('active', null, NOW), 45);
  assert.equal(statusTtlSeconds('boarding', null, NOW), 45);
  assert.equal(statusTtlSeconds('delayed', null, NOW), 45);
});

test('statusTtlSeconds: terminal states = 1800s', () => {
  assert.equal(statusTtlSeconds('landed', null, NOW), 1800);
  assert.equal(statusTtlSeconds('cancelled', null, NOW), 1800);
  assert.equal(statusTtlSeconds('diverted', null, NOW), 1800);
});

test('statusTtlSeconds: scheduled >3h away = 300s, <=3h away = 45s', () => {
  const farDep = new Date(NOW + 4 * 3600_000).toISOString();
  const nearDep = new Date(NOW + 2 * 3600_000).toISOString();
  assert.equal(statusTtlSeconds('scheduled', farDep, NOW), 300);
  assert.equal(statusTtlSeconds('scheduled', nearDep, NOW), 45);
  assert.equal(statusTtlSeconds('scheduled', null, NOW), 45);
});

test('position/weather/not-found TTL constants', () => {
  assert.equal(POSITION_TTL_SECONDS, 15);
  assert.equal(WEATHER_TTL_SECONDS, 600);
  assert.equal(NOT_FOUND_TTL_SECONDS, 30);
  assert.equal(STATUS_PHYSICAL_TTL_SECONDS, 900);
});

test('cache keys are canonical, versioned, and contain NO secret material', () => {
  const k1 = buildStatusKey('2026-07-11', 'BA178');
  const k2 = buildStatusKey('2026-07-12', 'BA178');
  assert.equal(k1, 'https://flightline.cache/status/v1/2026-07-11/BA178');
  assert.notEqual(k1, k2); // canonical date separation
  assert.equal(buildPositionKey('4ca1fa'), 'https://flightline.cache/position/v1/4CA1FA');
  assert.equal(buildWeatherKey('egll'), 'https://flightline.cache/weather/v1/EGLL');
  for (const k of [k1, k2, buildPositionKey('x'), buildWeatherKey('y')]) {
    assert.ok(!/access_key|api_key|apikey|secret|key=/i.test(k));
  }
});

test('writeCached/readCached round-trips with freshness metadata', async () => {
  const cache = makeCacheStub();
  const key = buildStatusKey('2026-07-11', 'BA178');
  await writeCached(cache, key, { hello: 'world' }, { logicalTtl: 45, physicalTtl: 900, nowMs: NOW });

  const fresh = await readCached<{ hello: string }>(cache, key, NOW + 10_000);
  assert.ok(fresh);
  assert.equal(fresh!.fresh, true);
  assert.equal(fresh!.negative, false);
  assert.deepEqual(fresh!.data, { hello: 'world' });

  // Beyond logical TTL but still physically present -> not fresh (stale-if-error).
  const stale = await readCached<{ hello: string }>(cache, key, NOW + 60_000);
  assert.ok(stale);
  assert.equal(stale!.fresh, false);
  assert.deepEqual(stale!.data, { hello: 'world' });
  assert.ok(stale!.ageSeconds > 45);
});

test('readCached returns null for missing key', async () => {
  const cache = makeCacheStub();
  assert.equal(await readCached(cache, buildStatusKey('2026-07-11', 'XX1'), NOW), null);
});

test('negative entries are flagged', async () => {
  const cache = makeCacheStub();
  const key = buildStatusKey('2026-07-11', 'BA999');
  await writeCached(cache, key, { error: 'not found', code: 'not_found' }, {
    logicalTtl: NOT_FOUND_TTL_SECONDS,
    physicalTtl: NOT_FOUND_TTL_SECONDS,
    nowMs: NOW,
    negative: true,
  });
  const read = await readCached(cache, key, NOW + 5_000);
  assert.ok(read);
  assert.equal(read!.negative, true);
  assert.equal(read!.fresh, true);
});
