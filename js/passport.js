/** Collection review and import rules; catalog metadata remains authoritative. */
export function passportSummary(list) {
  return {
    total: list.length,
    regions: new Set(list.map((d) => d.region)).size,
    domains: new Set(list.map((d) => d.domain)).size,
    files: list.filter((d) => d.resources?.some((r) => r.kind === 'download')).length,
    apis: list.filter((d) => d.resources?.some((r) => r.kind === 'api')).length,
    sourceOnly: list.filter((d) => !d.resources?.some((r) => ['download', 'api'].includes(r.kind))).length,
  };
}
export function passportList(list, query = '', sort = 'saved') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const result = list.filter((d) => words.every((word) => [d.title, d.source, d.domain, d.region].join(' ').toLowerCase().includes(word)));
  if (sort === 'title') result.sort((a,b) => a.title.localeCompare(b.title));
  if (sort === 'coverage') result.sort((a,b) => b.coverageEnd - a.coverageEnd || a.title.localeCompare(b.title));
  return result;
}
export function importPassport(value, catalog) {
  if (!value || value.version !== 1 || !Array.isArray(value.datasets) || value.datasets.length > 1000) throw new Error('Choose a version 1 Atlas inventory JSON with up to 1,000 datasets.');
  if (value.datasets.some((d) => !d || typeof d.id !== 'string')) throw new Error('Each inventory dataset needs a catalog ID.');
  const known = new Set(catalog.map((d) => d.id));
  const ids = [...new Set(value.datasets.map((d) => d.id))];
  return { ids: ids.filter((id) => known.has(id)), skipped: ids.filter((id) => !known.has(id)).length };
}
