import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyUnit, compareUnits, UNIT_NOTE } from '../js/units.js';

test('energy is not mass; current US$ is not PPP', () => {
  assert.equal(classifyUnit('TWh').family, 'energy');
  assert.equal(classifyUnit('million tonnes').family, 'mass');
  assert.equal(compareUnits('TWh', 'Mt CO2').status, 'conflict');
  assert.equal(compareUnits('current US$', 'PPP (constant 2021 international $)').status, 'conflict');
  assert.equal(compareUnits('cases', 'cases').status, 'match');
  assert.equal(compareUnits('', 'TWh').status, 'unknown');
  assert.match(UNIT_NOTE, /Current US\$ is not PPP/);
});

test('longer labels win: per capita is a rate, not people', () => {
  assert.equal(classifyUnit('per capita').family, 'rate');
  assert.equal(classifyUnit('capita').family, 'people');
  assert.equal(classifyUnit('population').family, 'people');
  assert.equal(compareUnits('tonnes per capita', 'million tonnes').status, 'conflict');
  assert.equal(compareUnits('per capita', 'population').status, 'conflict');
  assert.equal(classifyUnit('bushels').status, 'unknown');
});
