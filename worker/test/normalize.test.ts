import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTrackInput,
  validateIataNumber,
  canonicalIataNumber,
  canonicalKey,
  isValidDate,
  isHex24,
  isIcaoAirport,
  normalizeStatus,
  toIsoOrNull,
  airlabsUtcToIso,
  localDatePart,
  matchesDate,
  metersToFeet,
  msToKnots,
  msToFpm,
  statuteMilesToKm,
  numOrNull,
  observedAtFromSeen,
  observedAtFromEpoch,
  isPositionStale,
} from '../src/normalize.ts';

test('validateTrackInput accepts and canonicalizes valid input', () => {
  const r = validateTrackInput({ airlineIata: 'ba', flightNumber: '178', date: '2026-07-11' });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.airlineIata, 'BA');
    assert.equal(r.value.iataNumber, 'BA178');
    assert.equal(r.value.date, '2026-07-11');
  }
});

test('validateTrackInput keeps flight number digits as given (no leading-zero strip)', () => {
  const r = validateTrackInput({ airlineIata: 'BA', flightNumber: '0178', date: '2026-07-11' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.iataNumber, 'BA0178');
});

test('validateTrackInput accepts numeric flight number', () => {
  const r = validateTrackInput({ airlineIata: 'BA', flightNumber: 178, date: '2026-07-11' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.iataNumber, 'BA178');
});

test('validateTrackInput rejects bad airline, flight number, and date', () => {
  assert.equal(validateTrackInput({ airlineIata: 'B', flightNumber: '1', date: '2026-07-11' }).ok, false);
  assert.equal(validateTrackInput({ airlineIata: 'BA', flightNumber: 'ABC', date: '2026-07-11' }).ok, false);
  assert.equal(validateTrackInput({ airlineIata: 'BA', flightNumber: '1', date: '2026-13-40' }).ok, false);
  assert.equal(validateTrackInput({ airlineIata: 'BA', flightNumber: '1', date: 'nope' }).ok, false);
  assert.equal(validateTrackInput(null).ok, false);
  assert.equal(validateTrackInput('x').ok, false);
});

test('validateIataNumber normalizes and validates', () => {
  const r = validateIataNumber('ba178');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value, 'BA178');
  assert.equal(validateIataNumber('!!').ok, false);
});

test('canonical helpers', () => {
  assert.equal(canonicalIataNumber('ba', '178'), 'BA178');
  assert.equal(canonicalKey('2026-07-11', 'ba178'), '2026-07-11:BA178');
});

test('isValidDate handles calendar edge cases', () => {
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2024-02-29'), true);
  assert.equal(isValidDate('2026-00-10'), false);
  assert.equal(isValidDate('2026-07-11'), true);
});

test('isHex24 and isIcaoAirport', () => {
  assert.equal(isHex24('4CA1FA'), true);
  assert.equal(isHex24('zzz'), false);
  assert.equal(isIcaoAirport('EGLL'), true);
  assert.equal(isIcaoAirport('LHR'), false);
});

test('normalizeStatus maps provider variants into the union', () => {
  assert.equal(normalizeStatus('scheduled'), 'scheduled');
  assert.equal(normalizeStatus('en-route'), 'active');
  assert.equal(normalizeStatus('en_route'), 'active');
  assert.equal(normalizeStatus('active'), 'active');
  assert.equal(normalizeStatus('landed'), 'landed');
  assert.equal(normalizeStatus('cancelled'), 'cancelled');
  assert.equal(normalizeStatus('canceled'), 'cancelled');
  assert.equal(normalizeStatus('diverted'), 'diverted');
  assert.equal(normalizeStatus('incident'), 'diverted');
  assert.equal(normalizeStatus('boarding'), 'boarding');
  assert.equal(normalizeStatus('delayed'), 'delayed');
  assert.equal(normalizeStatus(undefined), 'scheduled');
  assert.equal(normalizeStatus('weird'), 'scheduled');
});

test('toIsoOrNull passes through valid ISO, rejects junk', () => {
  assert.equal(toIsoOrNull('2026-07-11T14:30:00+01:00'), '2026-07-11T14:30:00+01:00');
  assert.equal(toIsoOrNull(''), null);
  assert.equal(toIsoOrNull('not-a-date'), null);
  assert.equal(toIsoOrNull(123 as unknown), null);
});

test('airlabsUtcToIso appends Z and converts space to T', () => {
  assert.equal(airlabsUtcToIso('2026-07-11 14:30'), '2026-07-11T14:30:00.000Z');
  assert.equal(airlabsUtcToIso(''), null);
});

test('localDatePart and matchesDate', () => {
  assert.equal(localDatePart('2026-07-11 14:30'), '2026-07-11');
  assert.equal(localDatePart('2026-07-11T14:30:00+01:00'), '2026-07-11');
  assert.equal(localDatePart('junk'), null);
  assert.equal(matchesDate('2026-07-11', '2026-07-11'), true);
  assert.equal(matchesDate('2026-07-12', '2026-07-11'), false);
  assert.equal(matchesDate(null, '2026-07-11'), false);
});

test('unit conversions treat zero as valid and null as null', () => {
  assert.equal(numOrNull(0), 0);
  assert.equal(numOrNull(null), null);
  assert.equal(numOrNull(undefined), null);
  assert.equal(metersToFeet(0), 0);
  assert.equal(metersToFeet(null), null);
  assert.ok(Math.abs((msToKnots(100) as number) - 194.384) < 1e-6);
  assert.ok(Math.abs((metersToFeet(1000) as number) - 3280.84) < 1e-6);
  assert.ok(Math.abs((msToFpm(5) as number) - 984.25) < 1e-6);
  assert.ok(Math.abs((statuteMilesToKm(10) as number) - 16.0934) < 1e-6);
});

test('observedAt conversions and staleness', () => {
  const now = Date.parse('2026-07-11T12:00:00.000Z');
  assert.equal(observedAtFromSeen(30, now), '2026-07-11T11:59:30.000Z');
  assert.equal(observedAtFromSeen(0, now), '2026-07-11T12:00:00.000Z');
  assert.equal(observedAtFromEpoch(now / 1000, now), '2026-07-11T12:00:00.000Z');
  assert.equal(isPositionStale('2026-07-11T11:59:30.000Z', now), false); // 30s old
  assert.equal(isPositionStale('2026-07-11T11:58:00.000Z', now), true); // 120s old
});
