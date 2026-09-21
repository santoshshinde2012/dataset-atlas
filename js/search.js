/** Small, deterministic search engine shared by the browser and MCP server. */
const STOP_WORDS = new Set(['a', 'an', 'and', 'data', 'dataset', 'datasets', 'for', 'in', 'of', 'the', 'to', 'with']);

function words(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/₂/g, '2')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z0-9]+/g) || [];
}

function canonical(word) {
  if (word === 'cities') return 'city';
  if (word === 'indian') return 'india';
  if (word === 'emissions') return 'emission';
  return word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word;
}

export function queryTerms(query) {
  return [...new Set(words(String(query).slice(0, 80)).map(canonical).filter((word) => !STOP_WORDS.has(word)))];
}

/** Zero means no match. Positive scores reward titles over descriptive text. */
export function searchScore(dataset, query, { includeFacets = true } = {}) {
  const terms = queryTerms(query);
  if (!terms.length) return 0;
  const title = new Set(words(dataset.title).map(canonical));
  const description = new Set(words(dataset.description).map(canonical));
  const source = new Set(words(dataset.source).map(canonical));
  const facets = includeFacets ? new Set(words(`${dataset.domain} ${dataset.region}`).map(canonical)) : new Set();
  let score = 0;
  for (const [index, term] of terms.entries()) {
    const contains = (set) => set.has(term) || (index === terms.length - 1 && term.length >= 3 && [...set].some((word) => word.startsWith(term)));
    if (contains(title)) score += 5;
    else if (contains(description)) score += 2;
    else if (contains(source)) score += 1;
    else if (contains(facets)) score += 1;
    else return 0;
  }
  return score;
}
