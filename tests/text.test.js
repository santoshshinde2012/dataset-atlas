import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, oneLine, hashId, normFormat, sizeLabel } from '../js/utils/text.js';

test('esc escapes all HTML-sensitive characters', () => {
  assert.equal(esc('<img src=x onerror="a&b">'), '&lt;img src=x onerror=&quot;a&amp;b&quot;&gt;');
  assert.equal(esc("it's"), 'it&#39;s');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
});

test('oneLine strips newlines and comment breakers for shell-comment safety', () => {
  assert.equal(oneLine('evil\n#!/bin/sh\nrm -rf ~'), 'evil !/bin/sh rm -rf ~');
  assert.equal(oneLine('plain title'), 'plain title');
  assert.ok(!oneLine('a\r\nb#c').includes('\n'));
  assert.ok(!oneLine('a\r\nb#c').includes('#'));
});

test('hashId is stable and url-safe', () => {
  const a = hashId('https://example.com/data');
  assert.equal(a, hashId('https://example.com/data'));
  assert.notEqual(a, hashId('https://example.com/other'));
  assert.match(a, /^d[a-z0-9]+$/);
});

test('normFormat folds raw labels into facet buckets', () => {
  assert.equal(normFormat('csv'), 'CSV');
  assert.equal(normFormat('TSV'), 'CSV');
  assert.equal(normFormat('SDMX'), 'API');
  assert.equal(normFormat('GeoJSON'), 'JSON');
  assert.equal(normFormat('NetCDF'), 'Raster');
  assert.equal(normFormat('Shapefile'), 'Geo');
  assert.equal(normFormat('Parquet'), 'Other');
});

test('sizeLabel switches to GB at 1000 MB', () => {
  assert.equal(sizeLabel(500), '500 MB');
  assert.equal(sizeLabel(2000), '2.0 GB');
});
