import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProject, decodeProject, encodeProject } from '../js/project.js';

const catalog = [{ id: 'da', resources: [] }, { id: 'db', resources: [] }];
const project = { version: 1, task: { country: 'IN', startYear: 2010, endYear: 2020, level: 'country' }, sourceIds: ['da'] };

test('project validation checks versions, country names and numeric year ordering', () => {
  assert.equal(normalizeProject({ ...project, version: 2 }, catalog), null);
  assert.equal(normalizeProject({ ...project, task: { ...project.task, country: 'constructor' } }, catalog), null);
  assert.equal(normalizeProject({ ...project, task: { ...project.task, startYear: '2.05e3', endYear: '2020' } }, catalog), null);
  assert.equal(normalizeProject({ ...project, task: { ...project.task, startYear: ['2010'] } }, catalog), null);
  assert.ok(normalizeProject({ ...project, task: { ...project.task, startYear: '2010', endYear: '2020' } }, catalog));
});

test('project membership is consistent when imports reference sources outside the project', () => {
  const parsed = normalizeProject({ ...project, includedIds: ['da', 'db'], pairIds: ['db', 'da'] }, catalog);
  assert.deepEqual(parsed.includedIds, ['da']);
  assert.deepEqual(parsed.pairIds, ['da']);
  assert.deepEqual(decodeProject(encodeProject(parsed), catalog), parsed);
});

test('malformed project display fields cannot crash draft restoration', () => {
  const malformed = JSON.parse('{"toString":null,"valueOf":null}');
  const parsed = normalizeProject({ ...project, name: malformed, task: { ...project.task, title: malformed, description: malformed } }, catalog);
  assert.equal(parsed.name, 'My research project');
  assert.equal(parsed.task.title, 'Custom research');
  assert.equal(parsed.task.description, '');
});
