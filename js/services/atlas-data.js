/** Fetch the published Atlas assets, then pass catalog data through its pure sanitizer. */
import { buildCatalog } from '../catalog.js';
import { withProfiles } from '../dataset.js';

export async function loadAtlasData(base = '', fetchData = globalThis.fetch) {
  const json = async (path) => {
    const response = await fetchData(`${base}data/${path}.json`);
    if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}`);
    return response.json();
  };
  const [world, countryRegion, countryCodes, rawCatalog, pilot, coverage] = await Promise.all([
    json('world-110m'),
    json('country-regions'),
    json('country-codes'),
    json('catalog'),
    json('pilot'),
    json('country-coverage').catch(() => ({ series: {} })),
  ]);
  return {
    world,
    countryRegion,
    countryCodes,
    catalog: withProfiles(buildCatalog(rawCatalog), pilot.profiles),
    rawCatalog,
    pilot,
    coverage,
    generated: typeof rawCatalog.generated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawCatalog.generated) ? rawCatalog.generated : null,
  };
}
