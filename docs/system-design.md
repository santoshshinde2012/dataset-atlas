# The Dataset Atlas — System Design

*Version 1.0 · July 2026 · companion to [the concept & research doc](dataset-atlas-concept-and-research.md)*

## 1. Problem and goals

Finding a dataset today means knowing *where to look* first (Kaggle? World Bank? WHO? a national portal?), then searching each source separately. A typical discovery-to-download journey costs 15–30 clicks across 3–4 tabs, and data outside the user's home region is effectively invisible.

**Product goal:** one interface where any user reaches a relevant dataset — view, visit, download — in **≤3 clicks: Region → Domain → Get**.

**Engineering goals:**

| Goal | Decision it drove |
|---|---|
| Zero-friction entry, instant load | Static SPA, no login, no landing page |
| Deployable anywhere for free | No build step, no server, no external runtime services |
| Works offline / air-gapped demos | All assets vendored locally (D3, TopoJSON, catalog) |
| Trustworthy catalog | Every entry link-verified twice; runtime sanitization as defense-in-depth |
| Maintainable by one person | SOLID module architecture, unit tests, CI, drift-prevention tests |

## 2. High-level architecture

The system has two planes: an **offline curation pipeline** that produces the catalog, and a **runtime SPA** that renders it. There is no backend — the "API" is a static JSON file.

```mermaid
flowchart LR
  subgraph Curation["Curation pipeline (offline, agent-assisted)"]
    A[Domain curators<br/>8 agents, web-verified] --> B[Adversarial verifiers<br/>per-domain link + metadata checks]
    B --> C[Merge · dedup · gap-fill]
    C --> D[npm run validate<br/>schema + editorial rules]
  end
  D --> E[(data/catalog.json<br/>139 entries)]
  subgraph Runtime["Runtime SPA (static hosting)"]
    E --> F[catalog.js<br/>sanitize + normalize]
    F --> G[store.js<br/>state · actions · selectors]
    G --> H[MapView<br/>globe/flat choropleth]
    G --> I[UI components<br/>topbar · rails · passport]
    H -->|select region| G
    I -->|actions| G
  end
```

## 3. Runtime module design

`js/main.js` is the composition root — the only module that knows every piece. Everything else depends on narrow interfaces.

```
js/
  config.js          registries: domains, regions, source types, presets, colors
  icons.js           inline SVG icon registry (stroke style, no emoji)
  store.js           single source of truth: state, actions, selectors, pub/sub
  catalog.js         loading + sanitization choke point
  filters.js         composable facet predicates + faceted counting
  dna.js             dataset "DNA" scoring (5 normalized metrics)
  manifest.js        Data Passport shell-script generation
  lib.js             adapter over vendored d3/topojson globals
  utils/             pure helpers (esc, oneLine/oneLineUrl, hashId, normFormat; $/el)
  services/          ports: pins storage (localStorage), clipboard, toast
  map/projections.js globe/flat strategies behind one interface
  map/map-view.js    map rendering + drag/zoom/auto-rotate/focus
  ui/                topbar, filter rail, card rail, passport drawer, tooltip
  main.js            composition root (dependency injection happens here)
```

**How SOLID lands here:**

- **Single responsibility** — each module has one reason to change; UI components own one panel each.
- **Open/closed** — a new domain, preset, source type, or map projection is a registry entry (`config.js`, `projections.js`), not a code edit.
- **Liskov substitution** — both projection strategies satisfy one documented contract (`create/baseScale/rotate/applyDrag/isVisible/focusLat/halfHeightRatio` + capability flags); MapView consumes it blindly.
- **Interface segregation** — components see only the store's `getState / select / actions / subscribe`; they never import each other.
- **Dependency inversion** — persistence, clipboard, and notifications are injected ports, so the store is unit-tested with fakes.

### State management

A ~120-line hand-rolled pub/sub store (no framework):

- **State**: `domain`, `sourceTypes`, `formats`, `minOpenness`, `search`, `region`, `preset`, `projection`, `passportOpen`, `pins`.
- **Actions** mutate state, persist side effects through injected ports, then `notify()`. Cross-cutting rules live in actions (e.g. selecting a region closes the passport drawer; changing domain clears a mismatched preset).
- **Selectors** derive filtered lists and faceted counts on demand — with a 139-entry catalog, recomputation is microseconds; no memoization needed.
- **Rendering**: components build static DOM once and update counts/classes in place on each notify, so keyboard focus and scroll positions survive re-renders. The card rail keys its rebuild on a signature of all filter inputs, letting pin toggles skip the rebuild entirely.

### Map rendering

- D3 `geoOrthographic` (draggable globe with ambient auto-rotation until first pointer interaction) and `geoNaturalEarth1` (flat, horizontal rotation + clamped vertical pan) behind the strategy interface.
- Countries are a **choropleth of region-level data availability**: fill = ramp(√(regionCount/maxCount)) recomputed live on every filter change. Region nodes are sized by √count and colored by the active domain.
- Selecting a region tweens rotation (shortest longitude arc) — and in flat mode a vertical pan — to center it.
- Country→region mapping is precomputed (`data/country-regions.json`, ISO-numeric → region) from UN M49 region data, so the runtime does no geometry classification.

## 4. Data model

One catalog entry (validated by `js/catalog.js` at load and `npm run validate` at edit time):

```json
{
  "title": "…", "description": "…",
  "domain": "climate|health|economy|agriculture|education|transport|energy|demographics",
  "region": "global|north-america|latin-america|europe|africa|asia|oceania",
  "source": "World Bank", "sourceType": "kaggle|intl-org|gov-portal|research|ngo",
  "url": "https://… (deep link to the dataset page, never a portal homepage)",
  "kaggleRef": "owner/slug  (Kaggle only, regex-whitelisted)",
  "formats": ["CSV", "API"], "license": "CC BY 4.0", "licenseOpenness": 0.8,
  "freshnessYear": 2025, "coverageStart": 1960, "coverageEnd": 2024,
  "granularity": "country|admin|city|point|grid", "approxSizeMB": 270
}
```

The five **DNA metrics** (freshness, coverage span, granularity, size, license openness) are pure functions of these fields (`js/dna.js`), normalized to (0, 1] so any two datasets compare visually.

## 5. Catalog pipeline (how entries get in)

1. **Curate** — one agent per domain proposes 12–15 real datasets with regional spread, fetching every URL to confirm it resolves to the dataset's own page.
2. **Adversarially verify** — a second, skeptical agent re-fetches every URL, cross-checks Kaggle refs, corrects license/coverage/freshness fields, and drops anything unverifiable. (In practice this pass corrected stale metadata and caught dead links that hand-curation missed.)
3. **Merge** — dedup by normalized URL, fill regional gaps, write `data/catalog.json`.
4. **Gate** — `npm run validate` re-runs the app's own sanitizer plus editorial rules (no duplicate URLs, kaggleRef↔URL consistency, coverage sanity, domain/region coverage matrix). CI runs it on every push.

## 6. Security model

The catalog is treated as **third-party data** even though it's committed to the repo (defense-in-depth for Phase 2, when entries will come from live APIs).

| Surface | Control |
|---|---|
| DOM injection (XSS) | Every catalog string interpolated into `innerHTML` passes `esc()`; icons come from a fixed registry |
| `href` injection | Sanitizer rejects any URL not matching `^https?://[^\s\x00-\x1f\x7f]+$` — no `javascript:`, no control bytes |
| Clipboard → terminal | URLs are whitespace/control-free end to end; C0/DEL bytes (ANSI escape injection) rejected at load |
| Exported shell manifest | Runs as a script, so: `kaggleRef` must match `^[\w.-]+/[\w.-]+$` or it's dropped; prose fields pass `oneLine()` (strips `\r\n#`); URLs pass `oneLineUrl()` (strips `\r\n`, keeps fragments); tests assert every non-command line is a comment |
| localStorage | Parse failures and quota errors are non-fatal; stored pin ids are pruned against the live catalog at boot |

## 7. UX and accessibility decisions

Modeled on farmlandatlas.com's interaction grammar: the map is the persistent stage; layers/filters are toggles, never navigation; global controls on top; counts everywhere so a click's yield is known before clicking; presets in front of full filters (progressive disclosure).

- Keyboard: region nodes are `role="button"`/`tabindex=0` (Enter/Space select); `/` opens search; `Esc` closes panels in stacking order. The map SVG is `role="group"` so injected buttons keep their semantics.
- `prefers-reduced-motion` disables auto-rotation and all animations.
- Toast is an `aria-live` region; drawers carry dialog roles; the collapsed rail leaves the tab order via `visibility: hidden`.
- Iconography is a single inline-SVG stroke set (`js/icons.js`) — consistent weight and sizing, tinted by each context's accent, no emoji.
- Boot failures (file://, missing vendor, data fetch) surface a static fallback via a classic-script watchdog that module-graph errors can't bypass.

## 8. Testing and CI

- **37 unit tests** (`node --test`, zero dependencies) over the pure modules: sanitizer (including injection cases), facet predicates, manifest hardening, DNA scoring, store behavior, and a **theme-drift test** that fails CI if CSS and config accent colors diverge.
- **Live verification** during development: every feature exercised in a real browser (projections, filters, pinning, manifest export, keyboard paths, mobile layout).
- **CI** (GitHub Actions): syntax-check every module → unit tests → catalog validation. No install step — the pipeline is as dependency-free as the app.
- Three adversarial multi-agent review rounds (4 lenses each, findings verified by independent skeptic agents before being acted on) ran during development; 30 confirmed findings were fixed.

## 9. Performance characteristics

- **Payload**: ~110 KB world topology + ~90 KB catalog + ~280 KB vendored D3 (all cacheable, no CDN dependency). First paint is the static shell; the map renders as soon as three parallel fetches resolve.
- **Interaction**: filter changes trigger cheap in-place updates (attribute/text writes + one fill recompute over 177 country paths). Full path regeneration happens only on drag/zoom/rotate frames, which the 110m-resolution topology sustains comfortably.
- **Memory**: the whole dataset lives in one in-memory array; selectors recompute rather than cache.

## 10. Constraints and non-goals (v1)

- No server-side search or personalization — the catalog ships whole (fine to ~5k entries; beyond that, pre-computed indexes or a search service would be warranted).
- No live freshness — counts and metadata update when the catalog file is regenerated, not in real time.
- Single language (English), single catalog edition.

## 11. Roadmap

| Phase | Scope | Architectural impact |
|---|---|---|
| **2 — auto-enrichment** | Nightly job hits Kaggle (`datasets_list`), World Bank, and HDX APIs to refresh counts/freshness and propose new entries | A scheduled CI workflow writing `catalog.json` via the existing validate gate; the runtime is unchanged |
| **3 — use-case bundles** | "I want to…" flows that pre-assemble 3–5 datasets into a one-click passport | New `bundles` registry in config; passport accepts a preset list |
| **3 — shareable passports** | Pins encoded in the URL hash for link sharing | Store serializes pins to `location.hash`; no backend needed |
