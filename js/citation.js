/**
 * Citation generation (BibTeX). Pure functions over catalog entries —
 * every field a dataset citation needs is already in the schema.
 */

const bibEscape = (s) => String(s).replace(/[{}]/g, '').replace(/([&%#_])/g, '\\$1');

const citeKey = (d) =>
  `atlas_${(d.source || 'dataset').toLowerCase().replace(/[^a-z0-9]+/g, '')}_${d.freshnessYear || 'nd'}_${(d.id || '').slice(-4)}`;

/** @returns {string} a BibTeX @misc entry for one dataset */
export function bibtexFor(d, accessedDate) {
  const lines = [
    `@misc{${citeKey(d)},`,
    `  title        = {${bibEscape(d.title)}},`,
    `  author       = {{${bibEscape(d.source)}}},`,
    `  year         = {${d.freshnessYear || 'n.d.'}},`,
    `  howpublished = {\\url{${d.url}}},`,
    `  note         = {License: ${bibEscape(d.license)}; coverage ${d.coverageStart}--${d.coverageEnd}` +
      (accessedDate ? `; accessed ${accessedDate}` : '') + '}',
    '}',
  ];
  return lines.join('\n');
}

/** @returns {string} a references.bib document for a list of datasets */
export function bibliographyFor(list, accessedDate) {
  return list.map((d) => bibtexFor(d, accessedDate)).join('\n\n') + '\n';
}
