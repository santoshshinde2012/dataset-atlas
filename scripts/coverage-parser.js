/** Country-year coverage extraction. No network or filesystem side effects. */
import { iso2For, isAggregate } from '../js/identifiers.js';

// Stream records so large provider files do not need a second full-size row array.
function* csvRecords(text) {
  let row = [], cell = '', quoted = false, closed = false, started = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += ch;
    } else if (ch === '"') {
      if (cell || closed) throw new Error('Unexpected quote in coverage CSV field');
      quoted = true; started = true;
    }
    else if (ch === ',') { row.push(cell); cell = ''; closed = false; started = true; }
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (started && (row.length > 1 || cell.trim() || closed)) yield row;
      row = []; cell = ''; closed = false; started = false;
    } else if (closed) {
      if (ch !== ' ' && ch !== '\t') throw new Error('Unexpected text after quoted coverage CSV field');
    } else { cell += ch; started = true; }
  }
  if (quoted) throw new Error('Unclosed quoted coverage CSV field');
  if (started && (row.length || cell.trim() || closed)) { row.push(cell); yield row; }
}

function validateRow(cells, header, allowTrailingEmpty = false) {
  let width = header.length;
  if (allowTrailingEmpty) while (header[width - 1] === '') width--;
  if (cells.length < width || (cells.length > width && (!allowTrailingEmpty || cells.slice(width).some((value) => value !== '')))) {
    throw new Error('Coverage CSV row width does not match its header');
  }
}

function countryYear(code, year) {
  const iso3 = String(code || '').trim().toUpperCase();
  const y = Number(year);
  if (!/^[A-Z]{3}$/.test(iso3) || isAggregate(iso3) || !iso2For(iso3)) return null;
  if (!Number.isInteger(y) || y < 1800 || y > 2100) return null;
  return { iso2: iso2For(iso3), year: y };
}

function hasValue(value) {
  return value !== undefined && value.trim() !== '' && Number.isFinite(Number(value));
}

function remember(spans, iso2, year) {
  const previous = spans[iso2];
  spans[iso2] = previous ? [Math.min(previous[0], year), Math.max(previous[1], year)] : [year, year];
}

export function parseWideBank(text) {
  const records = csvRecords(text);
  let header;
  for (let next = records.next(); !next.done; next = records.next()) {
    if (next.value[0] === 'Country Name') { header = next.value; break; }
  }
  if (!header) throw new Error('World Bank CSV has no country header');
  const codeAt = header.indexOf('Country Code');
  const nameAt = header.indexOf('Country Name');
  const years = header.flatMap((h, i) => /^\d{4}$/.test(h) ? [[i, Number(h)]] : []);
  if (codeAt < 0 || !years.length) throw new Error('World Bank CSV has no country/year columns');
  const spans = {}, sampleRows = [];
  for (const cells of records) {
    validateRow(cells, header, true);
    const observations = years.filter(([index, year]) => hasValue(cells[index]) && countryYear(cells[codeAt], year));
    for (const [, year] of observations) {
      const { iso2 } = countryYear(cells[codeAt], year);
      remember(spans, iso2, year);
    }
    if (sampleRows.length < 3 && observations.length) {
      const [index, year] = observations.reduce((latest, current) => current[1] > latest[1] ? current : latest);
      sampleRows.push([cells[nameAt], iso2For(cells[codeAt]), cells[index], String(year)]);
    }
  }
  return {
    spans,
    sample: sampleRows.length ? { columns: ['Country', 'ISO2', 'Value', 'Year'], rows: sampleRows, source: 'World Bank CSV (3 non-aggregate rows)' } : null,
  };
}

export function parseLongCsv(text) {
  const records = csvRecords(text);
  const header = records.next().value || [];
  const codeAt = ['Code', 'iso_code', 'ISO3', 'Country Code'].map((name) => header.indexOf(name)).find((i) => i >= 0);
  const yearAt = ['Year', 'year'].map((name) => header.indexOf(name)).find((i) => i >= 0);
  const entityAt = header.indexOf('Entity');
  const metadata = new Set(['Entity', 'Code', 'iso_code', 'ISO3', 'Country Code', 'Year', 'year', 'country', 'Country', 'Country Name']);
  const valueColumns = header.flatMap((name, index) => metadata.has(name) ? [] : [index]);
  if (codeAt === undefined || yearAt === undefined || !valueColumns.length) throw new Error('Coverage CSV has no country/year/value columns');
  const spans = {}, sampleRows = [], columns = header.slice(0, 6);
  for (const cells of records) {
    validateRow(cells, header);
    const country = countryYear(cells[codeAt], cells[yearAt]);
    if (!country || !valueColumns.some((index) => hasValue(cells[index]))) continue;
    remember(spans, country.iso2, country.year);
    if (sampleRows.length < 3) sampleRows.push(columns.map((_, index) => cells[index] ?? ''));
  }
  return {
    spans,
    sample: entityAt >= 0 && sampleRows.length ? { columns, rows: sampleRows, source: 'First country rows of the provider CSV' } : null,
  };
}

/** Failed downloads retain prior checked spans; removed catalog URLs do not. */
export function retainedSeries(previous, datasets) {
  const urls = new Set(datasets.map((dataset) => dataset.url));
  return Object.fromEntries(Object.entries(previous?.series || {}).filter(([url]) => urls.has(url)));
}

/** Multiple checked resources contribute observations to the same dataset. */
export function mergeSpans(left, right) {
  const merged = { ...left };
  for (const [iso2, [start, end]] of Object.entries(right)) {
    const previous = merged[iso2];
    merged[iso2] = previous ? [Math.min(previous[0], start), Math.max(previous[1], end)] : [start, end];
  }
  return merged;
}

/** Replace a dataset's evidence only when every attempted resource was checked. */
export function reconcileSeries(previous, attempts) {
  const series = { ...previous };
  const byUrl = new Map();
  for (const attempt of attempts) {
    if (!byUrl.has(attempt.url)) byUrl.set(attempt.url, []);
    byUrl.get(attempt.url).push(attempt.spans);
  }
  for (const [url, spans] of byUrl) {
    // A partial fetch cannot establish absence in the resources that failed.
    // Keep previous evidence, or leave new datasets unchecked until a complete run.
    if (spans.some((value) => value === null)) continue;
    series[url] = spans.reduce((combined, value) => mergeSpans(combined, value), {});
  }
  return series;
}
