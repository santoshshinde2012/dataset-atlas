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
  assert.equal(pilot.profiles.length, 19);
  for (const profile of pilot.profiles) assert.ok(catalog.some((d) => d.url === profile.url), profile.url);
});

test('fit exposes geographic conflict and unknown country coverage', () => {
  const rain = get('sub-divisional-monthly-rainfall');
  const result = assessFit(rain.dataset, rain.profile, { ...pilot.tasks[0], country: 'US' });
  assert.equal(result.status, 'conflict');
  assert.ok(result.reasons.some((r) => r.text.includes('outside documented coverage')));
  const fao = get('faostat');
  assert.ok(assessFit(fao.dataset, fao.profile, pilot.tasks[0]).reasons.some((r) => r.status === 'unknown'));
});

test('rainfall vs district is review when a crosswalk is documented', () => {
  const rain = get('sub-divisional-monthly-rainfall');
  const result = assessFit(rain.dataset, rain.profile, pilot.tasks[0]);
  assert.equal(result.status, 'review');
  assert.ok(result.reasons.some((r) => /subdivision|crosswalk/i.test(r.text)));
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

test('matching key names alone leave an unverified pair under review', () => {
  const fao = get('faostat');
  const yields = get('crop-yields');
  const result = assessJoin(fao.profile, yields.profile, fao.dataset, yields.dataset);
  assert.equal(result.status, 'review');
  assert.ok(result.notes.some((note) => note.text.includes('cardinality')));
});

test('verified crop-rainfall kit joins via the IMD crosswalk', () => {
  const crop = get('crop-production-in-india');
  const rain = get('sub-divisional-monthly-rainfall');
  const join = assessJoin(crop.profile, rain.profile, crop.dataset, rain.dataset);
  assert.equal(join.status, 'match');
  assert.equal(join.kit.id, 'india-crop-rainfall');
  assert.ok(join.notes.some((n) => n.text.includes('subdivision')));
});

test('verified covid kit joins after daily→year; OpenAQ vs national PM2.5 is a refusal', () => {
  const covid = get('covid-19-data');
  const pop = get('SP.POP.TOTL');
  const join = assessJoin(covid.profile, pop.profile, covid.dataset, pop.dataset);
  assert.equal(join.status, 'match');
  assert.equal(join.kit.id, 'covid-population');
  const aq = get('openaq.org');
  const pm = get('EN.ATM.PM25.MC.M3');
  const refuse = assessJoin(aq.profile, pm.profile, aq.dataset, pm.dataset);
  assert.equal(refuse.status, 'conflict');
  assert.equal(refuse.doNotJoin, true);
  const ab = get('cod-ab-nga');
  const ps = get('cod-ps-nga');
  const pcode = assessJoin(ab.profile, ps.profile, ab.dataset, ps.dataset);
  assert.equal(pcode.status, 'match');
  assert.equal(pcode.kit.id, 'nga-pcode-population');
});
