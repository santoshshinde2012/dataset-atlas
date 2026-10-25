import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLongCsv, parseWideBank, retainedSeries, mergeSpans, reconcileSeries } from '../scripts/coverage-parser.js';

test('long coverage CSV requires a nonmissing measure, while zero is observed', () => {
  const parsed = parseLongCsv('Entity,Code,Year,Population,Other\nIndia,IND,1990,,\nIndia,IND,2000,NA,null\nIndia,IND,2010,0,\nIndia,IND,2020,,12\nWorld,OWID_WRL,2024,10,20\nUnknown,ZZZ,2025,12,\nIndia,IND,invalid,10,');
  assert.deepEqual(parsed.spans, { IN: [2010, 2020] });
  assert.equal(parsed.sample.rows.length, 2);
});

test('coverage CSV preserves quoted newlines and escaped quotes', () => {
  const parsed = parseLongCsv('Entity,Code,Year,Value\r\n"India\n(name ""quoted"")",IND,2020,2\r\n');
  assert.deepEqual(parsed.spans, { IN: [2020, 2020] });
  assert.equal(parsed.sample.rows[0][0], 'India\n(name "quoted")');
  assert.throws(() => parseLongCsv('Entity,Code,Year,Value\n"India,IND,2020,2'), /Unclosed/);
});

test('malformed coverage CSV cannot fabricate observations or confirmed absence', () => {
  const header = 'Entity,Code,Year,Value\n';
  for (const row of ['India,IND,2020,"1"2', 'India,IND,2020,""0', 'India,IND,2020,1"2', 'India,IND,2020,"1""']) {
    assert.throws(() => parseLongCsv(header + row), /quot/i);
  }
  for (const row of ['India,IND,2020', 'India,IND,2020,1,extra', '""']) {
    assert.throws(() => parseLongCsv(header + row), /row width/);
  }
  assert.deepEqual(parseLongCsv(header + 'India,IND,2020,"0" \t').spans, { IN: [2020, 2020] });
  assert.deepEqual(parseLongCsv(header + 'India,IND,2020,1\n \t\n  ').spans, { IN: [2020, 2020] });
});

test('wide World Bank coverage ignores placeholders and aggregates and retains zero', () => {
  const parsed = parseWideBank('"Data Source","World Bank"\n\n"Country Name","Country Code","Indicator Name","Indicator Code","1990","2000","2010","2020",\n"India","IND","Population","POP","..","","0","12",\n"World","WLD","Population","POP","2","3","4","5",');
  assert.deepEqual(parsed.spans, { IN: [2010, 2020] });
  assert.deepEqual(parsed.sample.rows, [['India', 'IN', '12', '2020']]);
});

test('World Bank rows allow the optional trailing blank column but reject truncated years', () => {
  const header = 'Country Name,Country Code,2000,2020,\n';
  assert.deepEqual(parseWideBank(header + 'India,IND,1,2').spans, { IN: [2000, 2020] });
  assert.deepEqual(parseWideBank(header + 'India,IND,1,2,').spans, { IN: [2000, 2020] });
  assert.throws(() => parseWideBank(header + 'India,IND,1'), /row width/);
  assert.throws(() => parseWideBank(header + 'India,IND,1,2,unexpected'), /row width/);
});

test('schema failures do not become a checked absence, while empty recognized files do', () => {
  assert.throws(() => parseLongCsv('country,year,comment\nIndia,2020,missing'), /country\/year\/value/);
  assert.throws(() => parseWideBank('<html>upstream error</html>'), /country header/);
  assert.deepEqual(parseLongCsv('Entity,Code,Year,Value\nIndia,IND,2020,').spans, {});
});

test('coverage refresh retains checked series after failed fetches and removes deleted URLs', () => {
  const previous = { series: { 'https://example.test/keep': { IN: [2000, 2020] }, 'https://example.test/removed': { BR: [2010, 2020] } } };
  const series = retainedSeries(previous, [{ url: 'https://example.test/keep' }, { url: 'https://example.test/new' }]);
  assert.deepEqual(series, { 'https://example.test/keep': { IN: [2000, 2020] } });
  series['https://example.test/keep'] = {};
  assert.deepEqual(previous.series['https://example.test/keep'], { IN: [2000, 2020] });
});

test('coverage combines observations from multiple checked resources', () => {
  const first = { IN: [2000, 2010] };
  assert.deepEqual(mergeSpans(first, { IN: [2005, 2020], BR: [1990, 2000] }), { IN: [2000, 2020], BR: [1990, 2000] });
  assert.deepEqual(mergeSpans(first, {}), first);
  assert.deepEqual(first, { IN: [2000, 2010] });
});

test('partial and complete resource failures retain previous evidence without claiming new absences', () => {
  const previous = { dataset: { IN: [2000, 2020], BR: [2010, 2020] } };
  for (const attempts of [
    [{ url: 'dataset', spans: { IN: [2000, 2025] } }, { url: 'dataset', spans: null }],
    [{ url: 'dataset', spans: null }, { url: 'dataset', spans: { IN: [2000, 2025] } }],
    [{ url: 'dataset', spans: null }, { url: 'dataset', spans: null }],
  ]) {
    assert.deepEqual(reconcileSeries(previous, attempts), previous);
    assert.deepEqual(reconcileSeries({}, attempts), {}, 'partially checked new datasets stay unknown');
  }
});

test('complete resource checks replace old evidence, merge observations and preserve checked emptiness', () => {
  const previous = { dataset: { IN: [1900, 1950], BR: [1900, 1950] }, unchanged: { FR: [2000, 2010] } };
  const updated = reconcileSeries(previous, [
    { url: 'dataset', spans: { IN: [2000, 2010] } },
    { url: 'dataset', spans: { IN: [2005, 2020], DE: [2000, 2020] } },
    { url: 'empty', spans: {} },
  ]);
  assert.deepEqual(updated, { dataset: { IN: [2000, 2020], DE: [2000, 2020] }, unchanged: { FR: [2000, 2010] }, empty: {} });
  assert.deepEqual(reconcileSeries(previous, [{ url: 'dataset', spans: {} }]).dataset, {}, 'a complete check may confirm no observations');
  assert.deepEqual(previous.dataset, { IN: [1900, 1950], BR: [1900, 1950] });
});
