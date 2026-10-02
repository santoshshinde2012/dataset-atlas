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

test('a missed refresh does not claim a URL is unreachable', () => {
  const health = linkHealth({ verified: '2026-09-19' }, '2026-09-20', Date.parse('2026-09-21'));
  assert.equal(health.label, 'Not reverified as of 2026-09-20');
});

test('invalid and future check dates cannot establish health', () => {
  const now = Date.parse('2026-10-02');
  for (const verified of ['2026-02-30', '2026-13-01', '2026-10-03']) {
    assert.equal(linkHealth({ verified }, null, now).status, 'unknown');
  }
});
