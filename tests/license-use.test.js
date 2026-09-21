import { test } from 'node:test';
import assert from 'node:assert/strict';
import { licenseUse } from '../js/license-use.js';

test('CC0 is reusable; unknown stays unknown', () => {
  const open = licenseUse({ license: 'CC0 / Public domain', licenseOpenness: 1 });
  assert.equal(open.analysis, 'yes');
  assert.equal(open.redistribute, 'yes');
  const closed = licenseUse({ license: 'Unknown', licenseOpenness: 0 });
  assert.equal(closed.analysis, 'unknown');
  assert.equal(closed.aiTraining, 'unknown');
});

test('non-commercial licenses block AI training and commercial redistribution', () => {
  const use = licenseUse({ license: 'CC BY-NC-SA 4.0', licenseOpenness: 0.5 });
  assert.equal(use.redistribute, 'no-commercial');
  assert.equal(use.aiTraining, 'no-commercial');
});
