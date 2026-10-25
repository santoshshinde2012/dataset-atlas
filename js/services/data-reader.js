/** CSV parsing runs off the UI thread. Parquet loads DuckDB only on demand. */
import { MAX_ROWS, MAX_COLUMNS } from '../data-table.js';

export function readCsv(text, delimiter) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./data-worker.js', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Parsing timed out')); }, 30000);
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    worker.onmessage = ({ data }) => { finish(); data.error ? reject(new Error(data.error)) : resolve(data.table); };
    worker.onerror = worker.onmessageerror = () => { finish(); reject(new Error('Could not parse this file')); };
    try { worker.postMessage({ text, delimiter }); }
    catch (error) { finish(); reject(error); }
  });
}

export async function readParquet(file) {
  const base = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0';
  const duckdb = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm');
  const workerUrl = URL.createObjectURL(new Blob([`importScripts(${JSON.stringify(base + '/dist/duckdb-browser-mvp.worker.js')});`], { type: 'text/javascript' }));
  let worker, db, conn;
  try {
    worker = new Worker(workerUrl);
    db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.ERROR), worker);
    await db.instantiate(base + '/dist/duckdb-mvp.wasm');
    await db.registerFileBuffer('local.parquet', new Uint8Array(await file.arrayBuffer()));
    conn = await db.connect();
    const count = await conn.query("SELECT count(*) AS n FROM 'local.parquet'");
    if (Number(count.toArray()[0].n) > MAX_ROWS) throw new Error('File exceeds 100,000 rows');
    const result = await conn.query("SELECT * FROM 'local.parquet'");
    const columns = result.schema.fields.map((f) => f.name);
    if (columns.length > MAX_COLUMNS) throw new Error('File exceeds 80 columns');
    const rows = result.toArray().map((r) => columns.map((c) => r[c] === null ? '' : String(r[c])));
    return { columns, rows };
  } finally {
    // Cleanup failures must not hide a read error or leave the worker/blob alive.
    try { await conn?.close(); } catch { /* terminate the engine below */ }
    try { await db?.terminate(); } catch { /* terminate the worker directly below */ }
    try { worker?.terminate(); } finally { URL.revokeObjectURL(workerUrl); }
  }
}
