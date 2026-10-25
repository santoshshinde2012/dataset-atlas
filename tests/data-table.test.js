import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDelimited, tableCsv, MAX_COLUMNS, MAX_ROWS } from '../js/data-table.js';

test('CSV round trips preserve rows whose fields are all missing', () => {
  for (const table of [
    { columns: ['value'], rows: [[''], ['3'], ['']] },
    { columns: ['a', 'b'], rows: [['', ''], ['1', '2'], ['', '']] },
  ]) assert.deepEqual(parseDelimited(tableCsv(table)), table);
  assert.deepEqual(parseDelimited('a,b\n,\n1,2\n\n'), { columns: ['a', 'b'], rows: [['', ''], ['1', '2']] });
});

test('CSV rejects misplaced quotes and rows beyond the column limit', () => {
  assert.throws(() => parseDelimited('a\nnot"csv'), /quote/i);
  const header = Array.from({ length: MAX_COLUMNS }, (_, i) => `c${i}`).join(',');
  assert.throws(() => parseDelimited(header + '\n' + ','.repeat(MAX_COLUMNS)), /80 columns/);
});

test('CSV accepts its exact row and column limits and rejects overflow', () => {
  const columns = Array.from({ length: MAX_COLUMNS }, (_, i) => `c${i}`);
  const row = columns.map(() => '1');
  assert.deepEqual(parseDelimited(tableCsv({ columns, rows: [row] })), { columns, rows: [row] });
  const csv = 'value\n' + '1\n'.repeat(MAX_ROWS);
  assert.equal(parseDelimited(csv).rows.length, MAX_ROWS);
  assert.throws(() => parseDelimited(csv + '1\n'), /100,000 rows/);
});
