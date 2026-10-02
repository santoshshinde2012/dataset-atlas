/** Bounded CSV/TSV parsing and profiling, independent of the browser. */
import { csvText } from './exports.js';
export const MAX_ROWS = 100000;
export const MAX_COLUMNS = 80;
export function parseDelimited(text, delimiter = ',') {
  if (text.length > 25 * 1024 * 1024) throw new Error('File exceeds 25 MB limit');
  const records = []; let row = [], cell = '', quoted = false, closed = false;
  const pushRow = () => { row.push(cell); cell = ''; closed = false; if (row.some((c) => c !== '')) records.push(row); row = []; if (records.length > MAX_ROWS + 1) throw new Error('File exceeds 100,000 rows'); };
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; closed = false; if (row.length > MAX_COLUMNS) throw new Error('File exceeds 80 columns'); }
    else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (closed && !/\s/.test(c)) throw new Error('Unexpected text after a quoted CSV field');
    else cell += c;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (cell || row.length) pushRow();
  if (!records.length) throw new Error('File is empty');
  const columns = records.shift();
  if (columns.length > MAX_COLUMNS || columns.some((c) => !c.trim()) || new Set(columns).size !== columns.length) throw new Error('Use unique, nonempty column headings (up to 80)');
  const rows = records.map((r) => {
    if (r.length > columns.length) throw new Error('A row has more fields than the header');
    return [...r, ...Array(columns.length - r.length).fill('')];
  });
  return { columns, rows };
}
export function numericValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
export function profileTable(table) {
  return table.columns.map((name, i) => {
    let missing = 0, numeric = 0, min = Infinity, max = -Infinity;
    for (const row of table.rows) {
      if (row[i] === null || row[i] === undefined || String(row[i]).trim() === '') missing++;
      else { const n = numericValue(row[i]); if (n !== null) { numeric++; min = Math.min(min, n); max = Math.max(max, n); } }
    }
    return { name, missing, numeric, min: numeric ? min : null, max: numeric ? max : null };
  });
}
export function filterRows(table, { text = '', column = -1, min = null, max = null } = {}) {
  const q = text.toLowerCase();
  return table.rows.filter((r) => {
    if (q && !(column >= 0 ? String(r[column] ?? '') : r.join(' ')).toLowerCase().includes(q)) return false;
    if (min !== null || max !== null) {
      const n = numericValue(r[column]); if (n === null || (min !== null && n < min) || (max !== null && n > max)) return false;
    }
    return true;
  });
}
export const tableCsv = (table, rows = table.rows) => csvText(table.columns, rows);
