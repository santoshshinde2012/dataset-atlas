import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyVintage, compareVintage, fiscalReporter, VINTAGE_NOTE } from '../js/vintage.js';

test('Australia FY vs calendar emissions is a conflict; India FY is classified', () => {
  assert.equal(fiscalReporter('AUS').endMonth, 6);
  assert.equal(fiscalReporter('IND').endMonth, 3);
  const fy = classifyVintage({ basis: 'fiscal', iso3: 'AUS' });
  assert.equal(fy.status, 'fiscal');
  assert.match(fy.reason, /June/);
  const mix = compareVintage({ basis: 'fiscal', iso3: 'AUS' }, { basis: 'calendar' });
  assert.equal(mix.status, 'conflict');
  assert.match(mix.reason, /FY 2021–22|June/);
  const india = compareVintage({ basis: 'fiscal', iso3: 'IND' }, { basis: 'calendar' });
  assert.equal(india.status, 'conflict');
  assert.match(india.reason, /March/);
  assert.equal(compareVintage({ basis: 'mid-year' }, { basis: 'census-night' }).status, 'conflict');
  assert.equal(compareVintage({ basis: 'calendar' }, { basis: 'calendar' }).status, 'match');
  assert.equal(compareVintage({}, { basis: 'calendar' }).status, 'unknown');
  assert.equal(classifyVintage({ series: 'SP.POP.TOTL' }).basis, 'mid-year');
  assert.match(VINTAGE_NOTE, /Fiscal-year GDP/);
});
