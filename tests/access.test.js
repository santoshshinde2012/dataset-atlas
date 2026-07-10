import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessRequirement } from '../js/access.js';

test('kaggle sources need an account', () => {
  assert.deepEqual(
    accessRequirement({ sourceType: 'kaggle', licenseOpenness: 1 }),
    { label: 'Kaggle account', level: 'account' });
});

test('registration-tier licenses warn about sign-up', () => {
  assert.equal(accessRequirement({ sourceType: 'intl-org', licenseOpenness: 0.4 }).level, 'signup');
  assert.equal(
    accessRequirement({ sourceType: 'intl-org', licenseOpenness: 0.8, license: 'Free with registration' }).level,
    'signup');
});

test('restrictive licenses are flagged', () => {
  assert.equal(accessRequirement({ sourceType: 'research', licenseOpenness: 0.2 }).level, 'restricted');
});

test('open sources return null', () => {
  assert.equal(accessRequirement({ sourceType: 'intl-org', licenseOpenness: 0.8, license: 'CC BY 4.0' }), null);
  assert.equal(accessRequirement({ sourceType: 'gov-portal', licenseOpenness: 1, license: 'CC0' }), null);
});
