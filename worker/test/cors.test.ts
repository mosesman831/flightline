import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCorsHeaders, allowedOrigins, preflightHeaders } from '../src/cors.ts';
import type { Env } from '../src/types.ts';

const env: Env = {
  PAGES_ORIGIN: 'https://flightline.pages.dev',
  DEV_ORIGIN: 'http://localhost:5173',
};

test('allowedOrigins filters empties', () => {
  assert.deepEqual(allowedOrigins(env), ['https://flightline.pages.dev', 'http://localhost:5173']);
  assert.deepEqual(allowedOrigins({ PAGES_ORIGIN: 'https://x' }), ['https://x']);
  assert.deepEqual(allowedOrigins({}), []);
});

test('exact Pages origin is reflected', () => {
  const r = resolveCorsHeaders('https://flightline.pages.dev', env);
  assert.equal(r.forbidden, false);
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://flightline.pages.dev');
  assert.equal(r.headers['Vary'], 'Origin');
});

test('dev origin is reflected when configured', () => {
  const r = resolveCorsHeaders('http://localhost:5173', env);
  assert.equal(r.forbidden, false);
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
});

test('foreign origin is forbidden and never gets a wildcard', () => {
  const r = resolveCorsHeaders('https://evil.example', env);
  assert.equal(r.forbidden, true);
  assert.equal(r.headers['Access-Control-Allow-Origin'], undefined);
  assert.notEqual(r.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(r.headers['Vary'], 'Origin');
});

test('no Origin header (CLI/health) is allowed with no ACAO', () => {
  const r = resolveCorsHeaders(null, env);
  assert.equal(r.forbidden, false);
  assert.equal(r.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(r.headers['Vary'], 'Origin');
});

test('dev origin not allowed when unset', () => {
  const r = resolveCorsHeaders('http://localhost:5173', { PAGES_ORIGIN: 'https://flightline.pages.dev' });
  assert.equal(r.forbidden, true);
});

test('preflight advertises only GET/POST/OPTIONS and Content-Type, no credentials', () => {
  const h = preflightHeaders();
  assert.equal(h['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
  assert.equal(h['Access-Control-Allow-Headers'], 'Content-Type');
  assert.equal(h['Access-Control-Allow-Credentials'], undefined);
  assert.ok(!/x-api-key/i.test(JSON.stringify(h)));
});
