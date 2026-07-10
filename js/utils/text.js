/** Pure string/format utilities. No DOM, importable from Node tests. */

/** Escape a value for safe interpolation into innerHTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Collapse newlines and comment-breaking characters for shell-comment safety. */
export const oneLine = (s) => String(s).replace(/[\r\n#]+/g, ' ').trim();

/** Stable short id derived from a string (djb2, base36). */
export function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return 'd' + (h >>> 0).toString(36);
}

/** Normalize a raw format label into one of the atlas' format facets. */
export function normFormat(f) {
  const s = String(f).trim().toUpperCase();
  if (['CSV', 'TSV'].includes(s)) return 'CSV';
  if (['XLSX', 'XLS', 'EXCEL'].includes(s)) return 'XLSX';
  if (['API', 'REST', 'SDMX', 'ODATA'].includes(s)) return 'API';
  if (['JSON', 'GEOJSON'].includes(s)) return 'JSON';
  if (['GEOTIFF', 'TIFF', 'RASTER', 'GRIB', 'NETCDF', 'NC', 'HDF', 'COG'].includes(s)) return 'Raster';
  if (['SHP', 'SHAPEFILE', 'GPKG', 'KML'].includes(s)) return 'Geo';
  return 'Other';
}

/** Human-readable download size from megabytes. */
export const sizeLabel = (mb) =>
  mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;
