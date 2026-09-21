import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { queryTerms, searchScore } from '../js/search.js';

const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url))).datasets;

test('search ignores word order and common filler words', () => {
  const crop = catalog.find((d) => d.title === 'Crop Production in India (Kaggle)');
  assert.ok(searchScore(crop, 'India crop production') > 0);
  assert.ok(searchScore(crop, 'data for crop production in India') > 0);
  assert.equal(searchScore(crop, 'Brazil crop production'), 0);
});

test('search handles CO₂ spelling and keeps title matches ahead of description matches', () => {
  assert.deepEqual(queryTerms('CO₂ emissions'), ['co2', 'emission']);
  const title = { title: 'India crop production', description: '', source: '' };
  const description = { title: '', description: 'India crop production', source: '' };
  assert.ok(searchScore(title, 'India crop production') > searchScore(description, 'India crop production'));
});
