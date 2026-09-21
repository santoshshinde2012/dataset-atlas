import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkHealth } from '../js/link-health.js';

test('missing verified stamp is unknown, not healthy', () => {
  assert.equal(linkHealth({}).status, 'unknown');
});

test('a successful check on the catalog date is verified', () => {
  const now = Date.parse('2026-09-21T00:00:00Z');
  const health = linkHealth({ verified: '2026-09-20' }, '2026-09-20', now);
  assert.equal(health.status, 'verified');
});

test('a stamp older than the catalog check is stale', () => {
  const now = Date.parse('2026-09-21T00:00:00Z');
  const health = linkHealth({ verified: '2026-09-01' }, '2026-09-20', now);
  assert.equal(health.status, 'stale');
});
