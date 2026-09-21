/**
 * Adapter over the vendored UMD globals (vendor/d3.v7.min.js,
 * vendor/topojson-client.min.js — loaded as classic scripts in index.html).
 * Modules import from here instead of touching window, keeping the vendor
 * loading strategy swappable in one place.
 */
export const d3 = window.d3;
export const topojson = window.topojson;

if (!d3 || !topojson) {
  throw new Error('Vendor libraries missing — load vendor/*.js before the app module.');
}
