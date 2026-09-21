import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeResources, primaryResource, accessAction } from '../js/resource.js';

test('sanitizeResources drops unsafe URLs and unknown kinds become page', () => {
  const out = sanitizeResources([
    { url: 'https://example.org/file.csv', kind: 'download', format: 'CSV', label: 'File' },
    { url: 'javascript:alert(1)', kind: 'download' },
    { url: 'https://example.org/file.csv', kind: 'download' },
    { url: 'https://example.org/x', kind: 'mystery' },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].kind, 'download');
  assert.equal(out[1].kind, 'page');
});

test('accessAction prefers a verified file over the landing page', () => {
  const d = {
    url: 'https://example.org/page',
    landingPage: 'https://example.org/page',
    resources: [{ url: 'https://example.org/file.csv', kind: 'download', format: 'CSV', label: 'CSV' }],
  };
  const action = accessAction(d);
  assert.equal(action.primary.href, 'https://example.org/file.csv');
  assert.equal(action.primary.label, 'Download file');
  assert.equal(action.secondary.href, 'https://example.org/page');
  assert.equal(primaryResource(d).kind, 'download');
});

test('Kaggle stays a page plus CLI, never a fake file URL', () => {
  const action = accessAction({ url: 'https://www.kaggle.com/datasets/a/b', kaggleRef: 'a/b' });
  assert.equal(action.primary.kind, 'page');
  assert.equal(action.copy.text, 'kaggle datasets download -d a/b');
});
