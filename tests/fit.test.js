import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildCatalog } from '../js/catalog.js';
import { assessFit, assessJoin, projectReport } from '../js/fit.js';

const pilot = JSON.parse(readFileSync(new URL('../data/pilot.json', import.meta.url)));
const catalog = buildCatalog(JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url))));
const get = (fragment) => {
  const profile = pilot.profiles.find((p) => p.url.includes(fragment));
  return { profile, dataset: catalog.find((d) => d.url === profile.url) };
};

test('pilot profiles resolve to catalog entries', () => {
  assert.equal(pilot.profiles.length, 15);
  for (const profile of pilot.profiles) assert.ok(catalog.some((d) => d.url === profile.url), profile.url);
});

test('fit exposes geographic conflict and unknown country coverage', () => {
  const rain = get('sub-divisional-monthly-rainfall');
  const result = assessFit(rain.dataset, rain.profile, pilot.tasks[0]);
  assert.equal(result.status, 'conflict');
  assert.ok(result.reasons.some((r) => r.text.includes('crosswalk')));
  const fao = get('faostat');
  assert.ok(assessFit(fao.dataset, fao.profile, pilot.tasks[0]).reasons.some((r) => r.status === 'unknown'));
});

test('verified energy pair joins on ISO and year; conflicting grains are flagged', () => {
  const energy = get('owid/energy-data');
  const co2 = get('owid/co2-data');
  const join = assessJoin(energy.profile, co2.profile, energy.dataset, co2.dataset);
  assert.equal(join.status, 'match');
  assert.ok(join.notes.some((n) => n.text.includes('iso_code')));
  const plant = get('globalpowerplantdatabase');
  assert.equal(assessJoin(energy.profile, plant.profile, energy.dataset, plant.dataset).status, 'conflict');
  assert.match(projectReport(pilot.tasks[2], [energy, co2], [energy, co2]), /Pair compatibility/);
});
