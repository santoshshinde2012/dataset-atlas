# Architecture and repository conventions

This document describes the current implementation and is the reference for new files and structural changes. The dated [research audit](research-audit-2026-09-20.md) records product findings at its stated revision. Product rules for joins: [join kits](join-kits.md). Agent contract: [MCP](mcp.md). How to change the catalog or add a kit: [CONTRIBUTING.md](../CONTRIBUTING.md).

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

- **Single responsibility:** `search.js` handles query terms and scoring; `filters.js` combines facets; `store.js` owns state; `resource.js` owns distributions; `coverage.js` owns geography claims; `kits.js` owns verified pairs; `fit.js` owns screening; `license-use.js` owns reuse labels; `link-health.js` owns URL reachability; UI modules render and handle events; `focus-trap.js` handles modal keyboard containment.
- **Open/closed:** domain, region, source type, and preset registries live in `config.js`. Join kits are added in `js/kits.js`. New search providers belong in `external-catalogs.js`. Add a new adapter at its boundary instead of adding provider-specific branches throughout the UI.
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

The CSS remains one token-driven file at this size. Split it by stable component boundaries when a change materially reduces coupling; a partial folder rewrite would add requests and maintenance work without improving the present user flow. For modals, use native `<dialog>` plus keyboard verification in line with the [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
