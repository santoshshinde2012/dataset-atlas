import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cross = JSON.parse(readFileSync(new URL('../data/india-district-subdivision.json', import.meta.url)));
const norm = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const lookup = (state, district) =>
  cross.byDistrict[`${norm(state)}|${norm(district)}`] || cross.byState[norm(state)] || null;

test('sample crop rows all resolve to an IMD subdivision', () => {
  const text = readFileSync(new URL('../data/samples/india-crop-sample.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  for (const line of text) {
    const [state, district] = line.split(',');
    assert.ok(lookup(state, district), `${state} ${district}`);
  }
  assert.equal(lookup('Maharashtra', 'Pune'), 'Madhya Maharashtra');
  assert.equal(lookup('Maharashtra', 'Nagpur'), 'Vidarbha');
  assert.equal(lookup('Kerala', 'Thiruvananthapuram'), 'Kerala');
});

test('COVID sample drops aggregates and joins country-year one-to-one', () => {
  const cases = readFileSync(new URL('../data/samples/covid-cases-sample.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  const pop = readFileSync(new URL('../data/samples/wb-population-sample.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  const drop = new Set(['OWID_WRL', 'WLD', 'SAS', '']);
  const yearly = new Map();
  for (const line of cases) {
    const [iso, , date, n] = line.split(',');
    if (drop.has(iso) || iso.startsWith('OWID_')) continue;
    const key = `${iso}|${date.slice(0, 4)}`;
    yearly.set(key, (yearly.get(key) || 0) + Number(n));
  }
  const popMap = new Map();
  for (const line of pop) {
    const [iso, , year, value] = line.split(',');
    if (drop.has(iso)) continue;
    popMap.set(`${iso}|${year}`, Number(value));
  }
  const joined = [...yearly.keys()].filter((k) => popMap.has(k));
  assert.ok(joined.includes('IND|2020'));
  assert.ok(!yearly.has('OWID_WRL|2020'));
  assert.equal(joined.length, new Set(joined).size);
});

test('OpenAQ Pune sample shows intra-city spread; Nigeria P-codes beat names', () => {
  const aq = readFileSync(new URL('../data/samples/openaq-pune-sample.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  const means = {};
  for (const line of aq) {
    const [id, , , , , , , value] = line.split(',');
    means[id] = means[id] || [];
    means[id].push(Number(value));
  }
  const avg = Object.fromEntries(Object.entries(means).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
  assert.ok(Object.keys(avg).length >= 3);
  assert.ok(Math.max(...Object.values(avg)) / Math.min(...Object.values(avg)) >= 2);

  const table = JSON.parse(readFileSync(new URL('../data/nga-pcode-admin1.json', import.meta.url)));
  const ab = readFileSync(new URL('../data/samples/nga-cod-ab-sample.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  const ps = readFileSync(new URL('../data/samples/nga-cod-ps-sample.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
  const byCode = Object.fromEntries(ab.map((line) => line.split(',')));
  const nameJoin = ps.filter((line) => {
    const name = line.split(',')[1].toLowerCase();
    return Object.values(byCode).some((n) => n.toLowerCase() === name);
  });
  assert.ok(nameJoin.length < ps.length, 'name join misses Lagos State vs Lagos');
  for (const line of ps) {
    const pcode = line.split(',')[0];
    assert.ok(table.byPcode[pcode], pcode);
    assert.ok(byCode[pcode], pcode);
  }
});

test('LGD maps Ahmednagar and Ahilyanagar to 466; census 2011 is not LGD', () => {
  const table = JSON.parse(readFileSync(new URL('../data/india-lgd-district.json', import.meta.url)));
  const norm = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const key = (state, district) => `${norm(state)}|${norm(district)}`;
  assert.equal(table.byDistrict[key('Maharashtra', 'Ahmednagar')].lgd, '466');
  assert.equal(table.byDistrict[key('Maharashtra', 'Ahilyanagar')].lgd, '466');
  assert.equal(table.byDistrict[key('Maharashtra', 'Ahmednagar')].census2011, '522');
  assert.notEqual('522', '466');
});
