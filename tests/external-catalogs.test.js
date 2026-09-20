import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { externalCatalogs } from '../js/external-catalogs.js';

test('broader catalog links keep searches on official HTTPS hosts', () => {
  const sources = externalCatalogs('crop yield & rainfall');
  assert.equal(sources.length, 6);
  for (const source of sources) assert.equal(new URL(source.url).protocol, 'https:');
  assert.equal(new URL(sources[0].url).searchParams.get('q'), 'crop yield & rainfall');
  assert.equal(new URL(sources[1].url).searchParams.get('q'), 'crop yield & rainfall');
  assert.equal(new URL(sources[2].url).searchParams.get('query'), 'crop yield & rainfall');
  assert.equal(sources[3].searchesQuery, false);
});
