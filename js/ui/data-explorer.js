import { filterRows, profileTable, tableCsv, numericValue } from '../data-table.js';
import { readCsv, readParquet } from '../services/data-reader.js';
import { downloadText } from '../services/download.js';
import { esc } from '../utils/text.js';
import { setFieldError } from './form-controls.js';
import { trapModalFocus } from './focus-trap.js';

export function initDataExplorer() {
  const dialog = document.getElementById('data-explorer');
  const find = (id) => dialog.querySelector(`#${id}`);
  let table, filtered = [], opener, generation = 0;
  dialog.querySelector('.dialog-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
  dialog.addEventListener('keydown', (e) => trapModalFocus(dialog, e));
  document.getElementById('explorer-btn').onclick = () => open();
  const display = () => {
    if (!table) return;
    const min = numericValue(find('explorer-min').value), max = numericValue(find('explorer-max').value);
    const column = Number(find('explorer-filter-column').value);
    for (const id of ['explorer-min', 'explorer-max', 'explorer-filter-column']) setFieldError(find(id));
    find('explorer-export').disabled = false;
    if (find('explorer-min').validity.badInput || find('explorer-max').validity.badInput) {
      for (const id of ['explorer-min', 'explorer-max']) if (find(id).validity.badInput) setFieldError(find(id), 'Enter a valid number.');
      find('explorer-export').disabled = true; return false;
    }
    if ((min !== null || max !== null) && column < 0) { setFieldError(find('explorer-filter-column'), 'Choose a column for numeric limits.'); find('explorer-export').disabled = true; find('explorer-status').textContent = 'Choose a column for numeric limits.'; return false; }
    if (min !== null && max !== null && min > max) { setFieldError(find('explorer-max'), 'Maximum must be the same as or greater than minimum.'); find('explorer-export').disabled = true; find('explorer-status').textContent = 'Minimum must not exceed maximum.'; return false; }
    filtered = filterRows(table, { text: find('explorer-filter').value, column, min, max });
    find('explorer-status').textContent = `${filtered.length.toLocaleString()} of ${table.rows.length.toLocaleString()} rows · first 100 shown`;
    find('explorer-table').innerHTML = `<table><thead><tr>${table.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filtered.slice(0, 100).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const profile = profileTable({ columns: table.columns, rows: filtered });
    find('explorer-summary').innerHTML = `<details><summary>Column types, missing values and ranges</summary><ul>${profile.map((p) => `<li>${esc(p.name)}: ${p.numeric === filtered.length - p.missing && p.numeric ? 'numeric' : 'text or mixed'} · ${p.missing} missing${p.numeric ? ` · numeric range ${p.min}–${p.max}` : ''}</li>`).join('')}</ul></details>`;
    const x = Number(find('explorer-x').value), y = Number(find('explorer-y').value);
    const points = filtered.map((r) => [numericValue(r[x]), numericValue(r[y])]).filter((p) => p.every((v) => v !== null));
    const chart = find('explorer-chart'); chart.toggleAttribute('hidden', x < 0 || y < 0 || !points.length);
    if (chart.hasAttribute('hidden')) return true;
    points.sort((a, b) => a[0] - b[0]);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const [a, b] of points) { xmin = Math.min(xmin, a); xmax = Math.max(xmax, a); ymin = Math.min(ymin, b); ymax = Math.max(ymax, b); }
    const sx = (v) => 60 + (v - xmin) / (xmax - xmin || 1) * 540;
    const sy = (v) => 200 - (v - ymin) / (ymax - ymin || 1) * 170;
    const sampled = points.filter((_, i) => i % Math.max(1, Math.ceil(points.length / 500)) === 0);
    chart.innerHTML = `<title>${esc(table.columns[y])} by ${esc(table.columns[x])}; ${points.length} numeric rows, ${sampled.length} plotted</title><path d="M60 30V200H600" stroke="currentColor" fill="none"/>${sampled.map(([a, b]) => `<circle cx="${sx(a)}" cy="${sy(b)}" r="3" fill="currentColor"><title>${esc(table.columns[x])}: ${a}; ${esc(table.columns[y])}: ${b}</title></circle>`).join('')}<g fill="currentColor" font-size="12"><text x="60" y="222">${esc(xmin)}</text><text x="540" y="222">${esc(xmax)}</text><text x="4" y="36">${esc(ymax)}</text><text x="4" y="200">${esc(ymin)}</text><text x="240" y="238">${esc(table.columns[x])}</text><text x="65" y="20">${esc(table.columns[y])}</text></g>`;
    return true;
  };
  let renderTimer;
  for (const id of ['explorer-filter', 'explorer-filter-column', 'explorer-min', 'explorer-max', 'explorer-x', 'explorer-y']) find(id).oninput = () => { clearTimeout(renderTimer); renderTimer = setTimeout(display, 100); };
  find('explorer-export').onclick = () => { if (table && display()) downloadText('atlas-filtered.csv', tableCsv(table, filtered), 'text/csv'); };
  find('explorer-file').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setFieldError(e.target); dialog.removeAttribute('aria-busy');
    const token = ++generation;
    table = null; filtered = []; find('explorer-controls').hidden = true;
    find('explorer-table').innerHTML = ''; find('explorer-summary').innerHTML = ''; find('explorer-chart').setAttribute('hidden', '');
    if (file.size > 25 * 1024 * 1024) { setFieldError(e.target, 'Choose a file no larger than 25 MB.'); e.target.value = ''; find('explorer-status').textContent = 'File exceeds 25 MB limit.'; return; }
    const ext = file.name.toLowerCase().split('.').at(-1);
    if (!['csv', 'tsv', 'parquet'].includes(ext)) { setFieldError(e.target, 'Choose a CSV, TSV or Parquet file.'); e.target.value = ''; find('explorer-status').textContent = 'Choose a CSV, TSV or Parquet file.'; return; }
    find('explorer-status').textContent = ext === 'parquet' ? 'Loading Parquet analysis engine…' : 'Reading local file…';
    dialog.setAttribute('aria-busy', 'true');
    try {
      const result = ext === 'parquet' ? await readParquet(file) : await readCsv(await file.text(), ext === 'tsv' ? '\t' : ',');
      if (token !== generation) return;
      table = result;
      for (const id of ['explorer-filter', 'explorer-min', 'explorer-max']) find(id).value = '';
      const options = table.columns.map((c, i) => `<option value="${i}">${esc(c)}</option>`).join('');
      find('explorer-filter-column').innerHTML = '<option value="-1">All columns</option>' + options;
      for (const id of ['explorer-x', 'explorer-y']) find(id).innerHTML = '<option value="-1">No chart</option>' + options;
      find('explorer-controls').hidden = false; display();
    } catch (error) { if (token === generation) {
      setFieldError(e.target, `Could not read file: ${error.message}`); e.target.value = '';
      find('explorer-status').textContent = `Could not read file: ${error.message}. CSV can be explored without the Parquet engine.`;
    } } finally { if (token === generation) dialog.removeAttribute('aria-busy'); }
  };
  function open() { opener = document.activeElement; if (!dialog.open) dialog.showModal(); }
  return { open };
}
