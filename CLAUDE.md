# The Dataset Atlas

Map-first dataset discovery: Region → Domain → Get in ≤3 clicks. Dependency-free static SPA (no build step, no npm install). UI/UX modeled on farmlandatlas.com. Concept and UX research: `docs/dataset-atlas-concept-and-research.md`.

## Commands

- `npm start` — serve on http://localhost:4173 (or use the `.claude/launch.json` "atlas" preview config)
- `npm test` — unit tests (node --test, zero dependencies)
- `npm run validate` — schema-check `data/catalog.json` after editing it
- `npm run refresh` — liveness sweep + source-API freshness bumps + `generated` stamp (also runs weekly via `.github/workflows/refresh.yml`)

## Architecture (SOLID ES modules)

`js/main.js` is the composition root — the only module that knows every piece. Components depend on the store's `getState/select/actions/subscribe` surface and never import each other.

- `js/config.js` — registries: domains, regions, source types, presets, color ramp. Adding one is a config change; no rendering/filter code should need edits.
- `js/store.js` — single source of truth; persistence injected as a `{load, save}` port.
- `js/catalog.js` — the ONE sanitization choke point for the third-party catalog (URL scheme + control-char whitelist, kaggleRef regex). Never bypass it; anything reaching the clipboard or the exported shell manifest flows through here plus `js/manifest.js`'s `oneLine`/`oneLineUrl` hardening.
- `js/map/projections.js` — projection strategies; MapView consumes the documented interface blindly. New projection = new registry entry implementing the full contract in the header comment.
- Pure modules (`config`, `utils/text`, `filters`, `dna`, `manifest`, `catalog`, `store`) must stay Node-importable — tests import them directly. Browser-only code goes in `js/ui/`, `js/map/`, `js/services/`, `js/lib.js`.

## Conventions

- Every string interpolated into innerHTML goes through `esc()`; URLs into `href` only exist post-sanitizer.
- UI components build static DOM once and update counts/classes in place so keyboard focus and scroll survive re-renders.
- `data/catalog.json` entries were curated and link-verified by multi-agent workflows; run `npm run validate` after any edit and deep-link URLs directly to dataset pages (never portal homepages).
- Optional `countries` tags (≤4 ISO alpha-2) mark country-specific datasets and drive the map's country-focus behavior; tag only clearly identifiable covered countries, leave region-wide datasets untagged.
- Regions are config registry entries (`REGION_META`) — adding one needs a centroid, a `data/country-regions.json` remap, and catalog entries; no rendering-code changes.
