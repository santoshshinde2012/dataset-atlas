/** Authoritative catalogs that complement the small, reviewed atlas index. */
const PROVIDERS = [
  { name: 'Data.gov', scope: 'United States public data', home: 'https://catalog.data.gov/', search: 'https://catalog.data.gov/?q=' },
  { name: 'Humanitarian Data Exchange', scope: 'Humanitarian and crisis data', home: 'https://data.humdata.org/dataset/', search: 'https://data.humdata.org/dataset/?q=' },
  { name: 'Google Dataset Search', scope: 'Datasets across publishers', home: 'https://datasetsearch.research.google.com/', search: 'https://datasetsearch.research.google.com/search?query=' },
  { name: 'World Bank Data Catalog', scope: 'Development data worldwide', home: 'https://datacatalog.worldbank.org/' },
  { name: 'India Open Government Data', scope: 'Indian government data', home: 'https://data.gov.in/catalogs/' },
  { name: 'Eurostat Database', scope: 'European official statistics', home: 'https://ec.europa.eu/eurostat/web/main/data/database' },
];

export function externalCatalogs(query = '') {
  const term = String(query).trim().slice(0, 200);
  return PROVIDERS.map(({ name, scope, home, search }) => ({
    name, scope,
    url: term && search ? search + encodeURIComponent(term) : home,
    searchesQuery: Boolean(term && search),
  }));
}
