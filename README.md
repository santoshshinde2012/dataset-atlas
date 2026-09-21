# The Dataset Atlas

[Live atlas](https://santoshshinde2012.github.io/dataset-atlas/) · [License](LICENSE)

The Dataset Atlas helps people find datasets by geography and subject — and tells them whether those datasets can actually be used together. Select a region or country on the map, choose a domain, and open a **verified file** when one exists, or an honest source page when it does not. The catalog currently contains 171 curated entries across eight domains and seven world regions, plus global datasets. This is a reviewed starting set, not an exhaustive index of every dataset.

The browser app is a static site with no runtime package dependencies, account, or backend. It deploys to GitHub Pages at zero cost. D3 and TopoJSON are vendored in `vendor/` so the app can also run offline when served locally. Deployment copies browser assets into a clean `dist/` directory; it does not compile the app.

## Features

- Browse availability on a globe or flat map; focusing a country also surfaces **global country-year series** as candidates (World Bank, OWID), labelled as such — never as proven rows.
- Search with word-order-independent terms and filter by domain, source type, format, and license openness.
- Honest access actions: **Download file** / **Open API** when a DCAT-style resource is verified; **Open source** when only a landing page exists. Cards never pretend a portal homepage is a file.
- Reuse screening on each card (analysis / redistribute / AI training). Unknown stays unknown; this is not legal advice.
- Link health: last successful URL check, distinct from editorial content year and coverage end.
- Compare up to four datasets and pin selections in a Data Passport.
- Share a filtered view or pinned collection through a URL.
- Export an annotated shell manifest and BibTeX references (citation year is coverage end, not the freshness bar).
- Crawlable per-dataset HTML pages, `sitemap.xml`, and schema.org Dataset JSON-LD for Google Dataset Search.
- Local MCP server: `search_catalog`, `get_dataset`, `get_resource`, `list_bundles`, `list_kits`, `assess_fit`, `build_passport`.
- Search beyond the atlas through official catalogs. Those results are **unreviewed**.
- Research Workbench with two runnable kits: **energy vs CO₂** (OWID, country-year) and **India crop + rainfall** (IMD subdivision crosswalk + offline samples). COVID vs population has a documented daily→annual rule (no notebook yet).

**Export scope:** Kaggle entries include executable `kaggle datasets download` commands. World Bank indicators and selected OWID series include direct file or API URLs. Other entries are source-page URLs in shell comments. The manifest is a source inventory, not a complete automated downloader. Dataset licenses and access terms remain those of the source providers.

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

Run `node scripts/atlas-mcp.js`, or use the checked-in [`.mcp.json`](.mcp.json) with a compatible MCP client. The server exposes `search_catalog`, `get_dataset`, `get_resource`, `list_bundles`, `list_kits`, `assess_fit`, and `build_passport`. It uses the same sanitizer, fit checks, resource model, and citation generator as the browser app.

Verified join kits live in `js/kits.js`. The India crop/rainfall kit ships `data/india-district-subdivision.json`, offline samples, and `data/crop-rainfall-example.ipynb`. The energy/CO₂ kit ships `data/energy-co2-example.ipynb`.

## Repository layout

```text
data/                   Catalog, pilot metadata, notebooks, crosswalk, samples, map data
js/                     Browser app, pure logic, UI, and map modules
scripts/                Catalog validator, refresh job, and MCP server
dist/                   Generated browser-only deployment package (ignored by Git)
tests/                  Node.js unit tests
e2e/                    Playwright browser smoke tests
vendor/                 Runtime D3 and TopoJSON copies and license notices
.github/workflows/       CI, refresh, and Pages deployment
docs/                   Design and deployment notes
index.html, styles.css  Static application shell and styles
```

`js/main.js` wires the app together. `js/store.js` owns state and selectors. `js/catalog.js` sanitizes catalog entries before either UI or MCP code consumes them. Keep domain and region definitions in `js/config.js`, and add tests for behavior that changes.

See [architecture and conventions](docs/architecture-and-conventions.md) for module boundaries, naming, and change rules. The [repository cleanup audit](docs/repository-cleanup-audit-2026-09-21.md) explains which files were removed or retained. The [2026 product audit](docs/research-audit-2026-09-20.md) records dated findings; its P0 search, mobile, and dialog issues were resolved in PR #38.
