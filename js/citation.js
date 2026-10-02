/**
 * Citation generation (BibTeX). Publication year is included only when explicitly recorded;
 * coverage and editorial years belong in the note.
 */

const bibEscape = (s) => String(s).replace(/[{}]/g, '').replace(/([&%#_])/g, '\\$1');

const citeYear = (d) => Number.isInteger(d.publicationYear) ? d.publicationYear : 'nd';

const citeKey = (d) =>
  `atlas_${(d.source || 'dataset').toLowerCase().replace(/[^a-z0-9]+/g, '')}_${citeYear(d)}_${(d.id || '').slice(-4)}`;

/** @returns {string} a BibTeX @misc entry for one dataset */
export function bibtexFor(d, accessedDate) {
  const lines = [
    `@misc{${citeKey(d)},`,
    `  title        = {${bibEscape(d.title)}},`,
    `  author       = {{${bibEscape(d.source)}}},`,
    ...(Number.isInteger(d.publicationYear) ? [`  year         = {${d.publicationYear}},`] : []),
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
