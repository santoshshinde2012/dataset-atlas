import { parseDelimited } from '../data-table.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ table: parseDelimited(data.text, data.delimiter) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
