# Architecture and repository conventions

This document describes the current implementation and is the reference for new files and structural changes. Product rules for joins: [join kits](join-kits.md). Agent contract: [MCP](mcp.md). How to change the catalog or add a kit: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Dependency direction

```text
index.html → js/main.js (composition root)
                     ├── js/ui/ and js/map/ (browser adapters)
                     ├── js/store.js (state and selectors)
                     └── js/services/ (browser side effects)
                           ↓
                 pure js/*.js and js/utils/text.js
                           ↑
             scripts/ and tests/ (Node consumers)
```

Pure modules must not import DOM or browser globals. `main.js` wires them together. UI components receive the store and services they need; they do not import other UI components. `vendor-globals.js` is the only adapter for the vendored D3 and TopoJSON globals. This follows [JavaScript module boundaries](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) without introducing a build framework for a small static site.

These rules give the SOLID principles concrete meaning here:

- **Single responsibility:** `search.js` handles query terms and scoring; `filters.js` combines facets; `store.js` owns state; `resource.js` owns distributions; `coverage.js` owns geography claims; `kits.js` owns verified pairs; `identifiers.js` owns country vs aggregate codes; `units.js` owns quantity families; `vintage.js` owns year basis; `fit.js` owns screening; `license-use.js` owns reuse labels; `link-health.js` owns URL reachability; UI modules render and handle events; `focus-trap.js` handles modal keyboard containment.
- **Open/closed:** domain, region, source type, preset, and author-credit registries live in `config.js`. Join kits are added in `js/kits.js`. Identifier aggregates are added in `js/identifiers.js`. Unit families are added in `js/units.js`. Fiscal reporters are added in `js/vintage.js`. New search providers belong in `external-catalogs.js`. Add a new adapter at its boundary instead of adding provider-specific branches throughout the UI.
- **Liskov substitution and interface segregation:** browser services (`clipboard`, `storage`, `toast`) expose small, documented interfaces. A fake storage port can replace browser storage in store tests without changing consumer behavior.
- **Dependency inversion:** the store accepts its persistence port and components accept the store/services from `main.js`; pure logic does not reach into the DOM or filesystem.

## Directories and names

| Path | Responsibility | Naming rule |
|---|---|---|
| `data/` | Published catalog, reviewed pilot metadata, geographic reference files and the downloadable example | Descriptive lowercase kebab-case for new files; retain existing public URLs for compatibility |
| `js/` | Pure domain logic and the browser composition root | One responsibility per lower-kebab-case module; named exports use `camelCase` |
| `js/ui/` | DOM components and focused UI helpers | Lower-kebab-case by feature (`card-rail.js`, `workbench.js`) |
| `js/map/` | Map rendering and projection contracts | Lower-kebab-case by role |
| `js/services/` | Browser side effects behind small ports | Lower-kebab-case noun names |
| `scripts/` | Node validation, packaging, refresh and MCP entrypoints | Verb or task names in lower-kebab-case |
| `skills/` | Agent skill files that encode the join-kit contract | Keep `SKILL.md` frontmatter short; rules must match MCP tools |
| `server.json` | MCP registry card | GitHub stdio metadata only; do not publish npm unless asked |
| `tests/`, `e2e/` | Pure behavior tests and browser journeys | `<module>.test.js`, `<journey>.spec.js` |
| `vendor/` | Pinned third-party browser copies and notices | Upstream name/version; document origin and license in `vendor/README.md` |
| `docs/` | Maintainer guides, design decisions and research | Descriptive lower-kebab-case names; date research snapshots |

`index.html` and `styles.css` remain at the root to keep the current relative URLs and deployment package simple. GitHub Pages serves the app from a repository subpath. `scripts/build-site.js` explicitly lists published assets. Keep new browser modules and license notices in that list; do not expose tests, scripts or repository files in `dist/`. A directory move must preserve or deliberately redirect public asset URLs, update imports and the allowlist, and pass browser tests. Avoid moving files only to mimic a framework's default layout.

## Data and trust boundaries

`catalog.js` sanitizes external catalog entries before they reach cards, exports or the MCP server. New curated metadata requires source evidence and validation; unknown country coverage, license, schema and joins should stay unknown. The workbench is a screening tool. Only a documented, tested source pair should receive a verified join label. [DCAT 3](https://www.w3.org/TR/vocab-dcat-3/) is the reference for separating a dataset landing page from access services and downloadable resources when extending the schema.

The deployed app has no runtime API secret. Provider APIs requiring a key must be used during controlled build-time import or through a separately designed server, never from browser code. Source links and third-party content are data, not trusted HTML. Unknown country coverage, license, schema and joins stay unknown — never guessed into a `match`.

## Change sequence

1. Add a focused pure module when behavior is shared by browser and MCP, then add tests around user-visible behavior.
2. Wire browser behavior through `main.js`; keep dependencies directed toward pure modules and small services.
3. Add browser assets to the build allowlist and verify the package with `npm run build:site` and `npm run test:e2e`.
4. Run `npm run validate` for catalog or pilot changes. Review claims about coverage, access, freshness and license against the provider.
5. Deploy only after CI passes. Confirm the published Pages subpath and key assets load.

Component layouts use the root token-driven stylesheet; shared form controls are isolated in `styles/forms.css`. Split further by stable component boundaries when it reduces coupling. For modals, use native `<dialog>` plus keyboard verification in line with the [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Dataset pages serialize JSON-LD with escaped less-than characters so catalog text cannot terminate the script element. License markup uses a known license URL; access cost requires an explicit boolean `isAccessibleForFree`. Only download resources become `DataDownload` distributions; APIs remain visible API links. An optional integer `publicationYear` supplies the BibTeX year. Coverage and editorial years never stand in for publication dates.

## Research tools

`dataset.js` attaches reviewed pilot variables and schemas without changing catalog metadata. `search.js` interprets country phrases and year ranges; explicit filters use `requirements.js`. Filters and project links preserve candidate versus observed evidence. `project.js` validates project snapshots against the current catalog before restoring them; browser storage is an injected port. Exports in `exports.js` are shared by Passport, Workbench, and MCP, with `services/download.js` handling browser downloads.

The detail dialog, comparison dialog, and Workbench use native modal dialogs with focus containment. UI modules communicate through callbacks wired in `main.js`. `data-table.js` handles bounded CSV parsing/profiling; `services/data-worker.js` is a worker entry point reachable through the explicit URL in `data-reader.js`. Repository checks traverse worker URLs as well as static imports. `data-explorer.js` displays local rows, filters, and charts. CSV needs no external engine; Parquet lazily imports pinned DuckDB-Wasm from jsDelivr and never uploads selected files. Keep its version consistent across the ESM module, worker, and Wasm URLs.

Dropdowns use `js/ui/dropdown.js` throughout the sidebar, results, and dialogs. The module progressively enhances single-value selects and keeps their existing values/change events as the state interface. It discovers dynamically rendered controls, supports searchable long lists, keyboard navigation and focus return, and uses the Popover API to avoid clipping inside scrolling panels. Older browsers retain native selects. Style controls through shared theme tokens; do not add feature-specific dropdown implementations.

Form styling is centralized in `styles/forms.css` through control height, radius, font, and focus tokens. `js/ui/form-controls.js` supplies presentation classes, helper associations, and accessible inline feedback; it does not validate catalog or research rules. Pure year-range rules live in `js/requirements.js`, while each feature decides when to apply them. Invalid fields retain user input, are associated with their error text, and block exports of stale research requirements. Native file controls keep keyboard behavior, and custom dropdowns mirror validation attributes from the underlying select. Feature layouts stay in `styles.css`; reuse the shared control layer for new fields.

## Passport collection workflow

`js/passport.js` contains pure collection summaries, display filtering/sorting, and versioned inventory import validation. `js/ui/passport.js` owns the nonmodal drawer, local display state, single-operation undo, and export presentation. Pins and right-panel visibility belong to the store; collection search never changes membership. Imports merge deduplicated catalog IDs through `store.actions.importPins`, never trust imported metadata or URLs, and reject unsupported versions and malformed records. The UI applies a 2 MB file limit; the pure validator caps inventories at 1,000 entries. Resource summary categories can overlap (one dataset may have both files and APIs).

`main.js` injects details and Workbench callbacks into Passport. Workbench `addMany` batches the collection into the current draft, preserves existing requirements and sources, and persists once. All collection actions use every pin regardless of search. Passport closes before the Workbench modal opens; details open above the drawer and return focus to their source button. Removal and clearing move focus to Undo, preventing focus from falling onto a removed control. Export controls live in a disclosure within the scrolling body; only Workbench, sharing, and collection management occupy the fixed footer. Empty collections expose discovery and inventory import rather than disabled export controls.

Inventory import is a membership restore, not project restore: imported requirements and selected resources are intentionally ignored. Export scope follows current Atlas filters and existing shared export rules. JSON backup is the durability path when browser storage is unavailable. Regression tests cover import boundaries, source summaries, search, undo, detail focus return, bulk handoff, downloads, and narrow screens.
