# The Dataset Atlas

[Live atlas](https://santoshshinde2012.github.io/dataset-atlas/) · [License](LICENSE)

Built by [Santosh Shinde](https://github.com/santoshshinde2012) · [LinkedIn](https://www.linkedin.com/in/shindesantosh) · [Medium](https://medium.com/@santosh-shinde)

The Dataset Atlas helps people find datasets by geography and subject — and tells them whether those datasets can actually be used together. Select a region or country on the map, choose a domain, and open a **verified file** when one exists, or an honest source page when it does not. The catalog currently contains 176 curated entries across eight domains and seven world regions, plus global datasets. This is a reviewed starting set, not an exhaustive index of every dataset.

The core browser app is a static site with no runtime package install, account, or backend. The optional Parquet explorer loads pinned DuckDB-Wasm 1.32.0 and its dependencies from jsDelivr on demand. It deploys to GitHub Pages at zero cost. D3 and TopoJSON are vendored in `vendor/` so catalog discovery and local CSV exploration can also run offline when served locally. Parquet needs network access to load its engine. Deployment copies browser assets into a clean `dist/` directory; it does not compile the app.

**Required reading:** [join kits](docs/join-kits.md) · [MCP](docs/mcp.md) · [contributing](CONTRIBUTING.md) · [architecture](docs/architecture-and-conventions.md)

## Features

- Browse availability on a globe or flat map; focusing a country also surfaces **global country-year series** as candidates (World Bank, OWID), labelled as such — never as proven rows.
- Search with word-order-independent terms, country names and aliases, year ranges, reviewed variables and columns, and topic aliases. For example, `UK population 2010 2023` separates geography and dates from keywords. Results explain observed coverage or candidate status.
- A compact sidebar keeps search visible, groups advanced filters into expandable sections, and shows removable requirement chips. Shared custom dropdowns support keyboard navigation, searchable long lists, and light/dark themes throughout the app.
- Filter by domain, source, format, year overlap, geographic level, resource kind, country evidence, and reuse screening. Country evidence distinguishes recorded tags, observed rows, and unverified global candidates; observed spans do not certify continuous yearly data.
- Open **Details & resources** on a card to choose a distribution and inspect schema, static samples, units, join keys, source evidence, license, and link health. Add the dataset to a research project from the same panel.
- Focusing a country hides global series that were checked and have no rows for that country, and labels the ones that do with the observed year span. Unchecked series stay candidates.
- Honest access actions: **Download file** / **Open API** when a DCAT-style resource is verified; **Open source** when only a landing page exists. Cards never pretend a portal homepage is a file.
- Reuse screening on each card (analysis / redistribute / AI training). Unknown stays unknown; this is not legal advice.
- Link health: last successful URL check, distinct from editorial content year and coverage end.
- Compare up to four datasets, including pair compatibility, overlapping years, documented country overlap, units, and verified join kits. Pin selections in a Data Passport.
- Share a filtered view, pinned collection, or research project through a URL. Projects preserve country/year/variable requirements, chosen sources, exclusions, comparison pairs, and resource choices. Save up to 20 named projects locally or export/import project JSON.
- Export CSV/JSON resource inventories, Python download recipes, an annotated shell manifest, and BibTeX references (publication year is included only when explicitly recorded; coverage and editorial years stay in notes).
- Crawlable per-dataset HTML pages, `sitemap.xml`, and schema.org Dataset JSON-LD for Google Dataset Search.
- Local MCP server: `search_catalog`, `get_dataset`, `get_resource`, `list_bundles`, `list_kits`, `recommend_kit`, `assess_fit`, `assess_join`, `check_identifiers`, `check_units`, `check_vintage`, `get_crosswalk`, `build_passport`, `coverage_for_country`, `search_variables`. Agents must not invent a join when `recommend_kit` is empty. The server is local (`node scripts/atlas-mcp.js`); GitHub Pages serves the same catalog and does not run MCP.
- Search beyond the atlas through official catalogs. Those results are **unreviewed**.
- Research Workbench with verified kits: **energy vs CO₂**, **India crop + rainfall**, **COVID vs population**, **OWID CO₂ per capita**, **Nigeria P-code population**, **India LGD**, and verified **do-not-join** kits (OpenAQ vs national PM2.5, WDI GDP current US$ vs OWID CO₂, CHIRPS grid vs IMD).

**Local explorer:** open a CSV, TSV, or Parquet file, inspect missing values and numeric ranges, filter rows by text or numeric limits, plot two numeric columns, and export the filtered CSV. Files stay in the browser. Limits are 25 MB, 100,000 rows, and 80 columns; the table previews 100 rows and charts plot at most 500 sampled points. CSV parsing runs in a worker. Parquet loads its engine only when selected and shows a recoverable error if loading fails.

**Export scope:** Python recipes paginate supported World Bank APIs and subset recognized OWID CSVs by ISO country and year. They record download timestamps, SHA-256 checksums, and provenance; OWID Grapher metadata is requested when available. Other checked files retain provider scope, and unsupported APIs/source pages are skipped explicitly. Python recipes use the standard library and cap individual downloads at 100 MB. Kaggle entries include executable `kaggle datasets download` commands. World Bank indicators and selected OWID series include direct file or API URLs. Other entries are source-page URLs in shell comments. The manifest is a source inventory, not a complete automated downloader. Dataset licenses and access terms remain those of the source providers.

Global and regional result panels include collection search, a domain dropdown with counts, shared sorting controls, concise descriptions with Read more, and a consistent research toolbar for copying, citations, comparison, and saving. Source and detail actions stay visible on each card. Collection search shares the main search state and appears in share links.

## Data Passport

Use a dataset card’s bookmark button to build a collection across regions. Passport keeps pins in this browser and offers search, saved-order/title/coverage sorting, full source titles, provider links, coverage years, licenses, and dataset details. Its overview counts saved sources, regions, domains, recorded file links, APIs, and sources requiring provider follow-up. These are metadata signals, not a live availability or compatibility check.

**Use in Workbench** adds all pinned datasets to the current draft without replacing its question or existing sources. Review fit and join evidence there. Removing a source or clearing pins offers Undo until the next removal or page reload. Collection search only changes what is displayed; sharing, Workbench handoff, and exports always use every pin.

Open **Export options** for inventory JSON/CSV, BibTeX, Python recipes, or the shell manifest. JSON is a portable backup: **Import inventory JSON** merges recognized IDs, reports duplicates and unknown IDs, and leaves existing pins intact. Imports accept version 1 inventories up to 2 MB and 1,000 entries. Imported titles, URLs, resource choices, and requirements are not applied; the current catalog and current filters remain authoritative. Share links include pinned IDs and current discovery filters, not Workbench drafts. Local browser storage can be unavailable or cleared, so export JSON for a durable copy.

## Run locally

Requirements: Python 3 for the static server and Node.js 22 or newer for validation and tests.

```sh
npm start
```

Open <http://localhost:4173>. The browser app itself needs no `npm install`.

```sh
npm test                 # pure logic and MCP tests
npm run validate         # catalog schema and editorial checks
npm run refresh          # network link checks and source metadata (edits catalog.json)
npm run build:site       # create the deployable dist/ directory
```

Browser smoke tests use Playwright as a development dependency:

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

## Catalog and data provenance

The catalog lives in [`data/catalog.json`](data/catalog.json). Each entry records its landing page, optional `resources[]` (file or API), domain, region, format, license, approximate size, coverage years, `coverageKind`, and an editorially reviewed `freshnessYear`. Optional `countries` tags mark country-specific entries. `coverageKind: global-country-series` means a worldwide country-year indicator — focusing India can show it as a **candidate**, not a verified India extract.

The 16 additional World Bank indicators were checked against the official indicator and observations APIs. Their start and end years are the first and last nonempty observations for recognized countries across the entire series; individual countries may have shorter coverage. The size field is an estimate of the source API's full JSON response, not a promised download size. Provider catalog links are maintained in [`js/external-catalogs.js`](js/external-catalogs.js).

The workbench's reviewed metadata lives in [`data/pilot.json`](data/pilot.json). It records source links, access instructions, variables, join keys, geographic and time grain, direct resources where verified, and static source samples. Empty `countries` means coverage is unknown to this pilot, not worldwide coverage. A fit result screens metadata only; it does not guarantee a valid analysis. Direct API examples may be paginated. Add or revise pilot entries only after checking the linked source, update the review date, and run validation and browser tests. The example [energy/CO₂ notebook](data/energy-co2-example.ipynb) filters aggregate rows and checks one-to-one country-year keys before joining.

These fields have different meanings:

| Field | Meaning | Updated by |
|---|---|---|
| `freshnessYear` | Latest year of dataset content confirmed by editorial review | Catalog editor |
| `coverageEnd` | Latest year included in the data | Catalog editor |
| `sourceModifiedYear` | Year a supported source API says its page, repository, or package changed | Refresh job |
| `verified` | Date the dataset URL last returned a successful response | Refresh job |
| Top-level `generated` | Date the catalog was last checked | Refresh job |

A source metadata change does **not** prove the underlying observations changed. The refresh job therefore never changes `freshnessYear` or `coverageEnd`. An HTTP success verifies URL reachability, not dataset quality or license accuracy; blocked and transient responses do not receive a new `verified` stamp.

When editing the catalog, link to the specific dataset page and run `npm run validate`. The validator checks entry shapes, duplicate URLs, coverage order, starter-bundle references, pilot profile links, and pilot resource URL safety. It does not replace manual review of source metadata.

## Automation and deployment

| Workflow | Trigger | Result |
|---|---|---|
| [CI](.github/workflows/ci.yml) | Push, pull request, or deployment verification | Syntax, unit, catalog, and browser checks |
| [Deploy](.github/workflows/deploy-pages.yml) | Push to `main` or manual dispatch | Publishes to GitHub Pages only after CI succeeds |
| [Refresh](.github/workflows/refresh.yml) | Daily schedule or manual dispatch | Checks links, updates verified dates and source metadata, commits safe catalog changes, and requests deployment |

A dead link creates or updates the **Catalog links need review** issue and makes the refresh run fail visibly. Valid checks still reach `main`; the issue remains for a human to replace or remove the broken entry. The current refresh workflow commits validated catalog checks directly and does not create daily pull requests. Review the open issue when maintaining the catalog. Kaggle metadata checks are optional and require `KAGGLE_USERNAME` and `KAGGLE_KEY` repository secrets.

GitHub Pages publishes only `dist/`, which contains the application shell, browser modules, map data, catalog, and vendored libraries. It excludes repository documentation, test tools, MCP scripts, and local development files. Other static hosts can serve `dist/`; see [deployment guidance](docs/deployment-free-cloud.md).

## MCP interface

Run `node scripts/atlas-mcp.js`, or use the checked-in [`.mcp.json`](.mcp.json) with a compatible MCP client. The server exposes `search_catalog`, `get_dataset`, `get_resource`, `list_bundles`, `list_kits`, `recommend_kit`, `assess_fit`, `assess_join`, `check_identifiers`, `check_units`, `check_vintage`, `get_crosswalk`, `build_passport`, `coverage_for_country`, and `search_variables`. It uses the same sanitizer, fit checks, identifier list, unit list, vintage list, resource model, and citation generator as the browser app. `coverage_for_country` reads [`data/country-coverage.json`](data/country-coverage.json).

Typical agent flow: **recommend_kit** → **check_identifiers** → **check_units** / **check_vintage** → **get_crosswalk** → **get_resource** → **assess_join** → **build_passport**. If `recommend_kit` returns no kit, do not write join code. `assess_join` without a kit stays unknown or conflict — never a guessed `match`. A [SKILL.md](skills/join-kits/SKILL.md) encodes the same contract for coding agents. Registry metadata lives in [`server.json`](server.json).

Verified join kits live in `js/kits.js`. Identifier aggregates live in `js/identifiers.js`. Units live in `js/units.js`. Vintages live in `js/vintage.js`. The India crop/rainfall kit ships `data/india-district-subdivision.json`. The India LGD kit ships `data/india-lgd-district.json`. The Nigeria P-code kit ships `data/nga-pcode-admin1.json`. OpenAQ vs national PM2.5, CHIRPS vs IMD, and WDI GDP (current US$) vs OWID CO₂ are checked **do-not-join** kits.

## Repository layout

```text
data/                   Catalog, pilot metadata, notebooks, crosswalk, samples, map data
js/                     Browser app, pure logic, UI, and map modules
scripts/                Catalog validator, refresh job, and MCP server
skills/                 Agent skill for join kits (`SKILL.md`)
server.json             MCP registry metadata (GitHub stdio; not an npm package)
dist/                   Generated browser-only deployment package (ignored by Git)
tests/                  Node.js unit tests
e2e/                    Playwright browser smoke tests
vendor/                 Runtime D3 and TopoJSON copies and license notices
.github/workflows/       CI, refresh, and Pages deployment
docs/                   Design and deployment notes
index.html, styles.css  Static application shell and styles
```

`js/main.js` wires the app together. `js/store.js` owns state and selectors. `js/catalog.js` sanitizes catalog entries before either UI or MCP code consumes them. Keep domain and region definitions in `js/config.js`, and add tests for behavior that changes.

See [architecture and conventions](docs/architecture-and-conventions.md) for module boundaries, naming, and change rules. How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).
