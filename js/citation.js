/**
 * Citation generation (BibTeX). Year is the content coverage end when known;
 * editorial freshnessYear is a note, not a publication date.
 */

const bibEscape = (s) => String(s).replace(/[{}]/g, '').replace(/([&%#_])/g, '\\$1');

const citeYear = (d) => d.coverageEnd || d.freshnessYear || 'nd';

const citeKey = (d) =>
  `atlas_${(d.source || 'dataset').toLowerCase().replace(/[^a-z0-9]+/g, '')}_${citeYear(d)}_${(d.id || '').slice(-4)}`;

/** @returns {string} a BibTeX @misc entry for one dataset */
export function bibtexFor(d, accessedDate) {
  const year = d.coverageEnd || d.freshnessYear || 'n.d.';
  const lines = [
    `@misc{${citeKey(d)},`,
    `  title        = {${bibEscape(d.title)}},`,
    `  author       = {{${bibEscape(d.source)}}},`,
    `  year         = {${year}},`,
    `  howpublished = {\\url{${d.landingPage || d.url}}},`,
    `  note         = {License: ${bibEscape(d.license)}; coverage ${d.coverageStart}--${d.coverageEnd}` +
      (d.freshnessYear ? `; editorial content year ${d.freshnessYear}` : '') +
      (accessedDate ? `; accessed ${accessedDate}` : '') + '}',
    '}',
  ];
  return lines.join('\n');
}

/** @returns {string} a references.bib document for a list of datasets */
export function bibliographyFor(list, accessedDate) {
  return list.map((d) => bibtexFor(d, accessedDate)).join('\n\n') + '\n';
}
