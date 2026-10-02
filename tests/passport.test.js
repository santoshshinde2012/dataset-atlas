import test from 'node:test';
import assert from 'node:assert/strict';
import { passportSummary, passportList, importPassport } from '../js/passport.js';
const list = [
  { id:'a', title:'Rainfall', source:'Provider', domain:'climate', region:'asia', coverageEnd:2020, resources:[{kind:'download'},{kind:'api'}] },
  { id:'b', title:'Agriculture', source:'Other', domain:'agriculture', region:'global', coverageEnd:2024, resources:[] },
];
test('Passport summarizes resources without treating source pages as files', () => {
  assert.deepEqual(passportSummary(list), {total:2,regions:2,domains:2,files:1,apis:1,sourceOnly:1});
});
test('Passport search requires all words and sorting does not mutate saved order', () => {
  assert.deepEqual(passportList(list,'ASIA rainfall').map(d=>d.id),['a']);
  assert.deepEqual(passportList(list,'','coverage').map(d=>d.id),['b','a']);
  assert.deepEqual(list.map(d=>d.id),['a','b']);
});
test('Passport import deduplicates known IDs and ignores imported source metadata', () => {
  assert.deepEqual(importPassport({version:1,datasets:[{id:'a',url:'https://untrusted.example'},{id:'a'},{id:'missing'}]},list),{ids:['a'],skipped:1});
  for(const value of [null,{version:2,datasets:[]},{version:1,datasets:[{}]}])assert.throws(()=>importPassport(value,list));
});
