# The Dataset Atlas

**A map-first experience for discovering and downloading datasets across domains and regions — in 3 clicks or fewer: Region → Domain → Get.**

155 curated, link-verified datasets · 8 domains · 7 world regions + global (every domain×region cell ≥ 2 datasets) · country-level focus · self-refreshing catalog.

Instead of knowing *where to look* (Kaggle? World Bank? WHO? a national portal?), you start from a world map painted by data availability, filter by domain with one click, and every dataset card gives you a direct **Get data** link plus a one-click copy — the `kaggle datasets download` command for Kaggle sources, or the dataset link for everything else.

The UI/UX follows the interaction model of [farmlandatlas.com](https://farmlandatlas.com/): an answer-first map as the persistent stage, layers/filters as toggles in a side rail (never page navigation), global controls on top, zero-friction entry (no landing page, no login), and progressive disclosure (use-case presets in front, full filters behind).

## Running it

It's a fully static site — no build step, no dependencies to install. Serve the folder over HTTP:

```bash
python3 -m http.server 4173
# then open http://localhost:4173
```

Deploy by pointing any static host (GitHub Pages, Netlify, Cloudflare Pages) at the repo root — see the [free-cloud deployment guide](docs/deployment-free-cloud.md); a GitHub Pages workflow is already included.

## What's inside

| Piece | Purpose |
|---|---|
| `index.html`, `styles.css` | Markup and the dark map-first theme |
| `js/` | The app as SOLID ES modules (see Architecture below) |
| `tests/` | Unit tests for the pure logic modules (`npm test`) |
| `data/catalog.json` | The curated dataset catalog (multi-agent curated, link-verified) |
| `data/world-110m.json` | World country shapes (TopoJSON, from world-atlas) |
| `data/country-regions.json` | ISO-numeric country code → atlas region mapping |
| `vendor/` | Local copies of D3 v7 and topojson-client (works offline) |
| `docs/dataset-atlas-concept-and-research.md` | Concept, UX research, and source catalog behind the design |
| `docs/system-design.md` | System design: architecture, data model, security, testing, roadmap |
| `docs/deployment-free-cloud.md` | Zero-cost deployment guide (GitHub Pages, Cloudflare, Netlify, Vercel) |

## Architecture

The app is dependency-free ES modules with a small pub/sub store at the center; `js/main.js` is the composition root that wires everything (components never import each other):

```
js/
  config.js          registries: domains, regions, source types, presets (add one = config change)
  store.js           single source of truth: state, actions, selectors, subscribe
  catalog.js         loading + sanitization — the one choke point for untrusted catalog data
  filters.js         composable facet predicates + faceted counting
  dna.js             dataset "DNA" scoring (freshness/coverage/granularity/size/license)
  manifest.js        Data Passport shell-script generation (injection-hardened)
  lib.js             adapter over the vendored d3/topojson globals
  utils/             pure helpers: esc() HTML escaping, oneLine/oneLineUrl shell hardening,
                     hashId, format normalization (text.js); $/el DOM builders (dom.js)
  services/          ports: pins storage (localStorage), clipboard, toast
  map/projections.js globe/flat projection strategies behind one interface
  map/map-view.js    the map stage: rendering + drag/zoom/auto-rotate/focus
  ui/                topbar, filter rail, card rail, passport drawer, tooltip
  main.js            composition root: builds store + services, injects them
```

How the SOLID principles land here: each module has one reason to change (**S**); new domains, presets, and projections are registry entries, not code edits (**O**); both projection strategies satisfy one interface the map consumes blindly (**L**); components depend on the store's narrow `getState/select/actions/subscribe` surface (**I**); and persistence/clipboard/notifications are injected ports, so the store is unit-testable with fakes (**D**).

Run the tests and catalog checks with:

```bash
npm test           # unit tests (node --test, no dependencies to install)
npm run validate   # schema-check data/catalog.json after editing it
npm run refresh    # liveness sweep + source-API freshness bumps + generated stamp
```

CI (GitHub Actions, `.github/workflows/ci.yml`) syntax-checks every module and runs tests + validation on push. A second workflow (`refresh.yml`) runs the refresh weekly and opens a PR when links died or sources published newer data — the catalog stays current without a backend.

## Features

- **Answer-first map** — countries are tinted by how much data their region has for the current filters; each region is a glowing node sized by dataset count. Globe (draggable, auto-rotating) and flat projections.
- **Domain chips** — Climate, Health, Economy, Agriculture, Education, Transport, Energy, Demographics — filter the map live, with counts everywhere.
- **Left rail filters** — use-case presets ("I want to… forecast crop yields"), source type, format, and a license-openness slider.
- **Card rail** — click a region for its dataset cards: source badge, formats, license, description, and a **DNA strip** (freshness, coverage span, granularity, size, license openness at a glance).
- **Low-click download** — every card has *Get data* (deep link, opens the dataset page directly) and *Copy CLI* (`kaggle datasets download -d owner/slug`) or *Copy link*.
- **Country focus** — clicking a country (e.g. India) opens its region with that country's datasets sorted first and badged; the hover tooltip shows the country-specific count. 85 entries carry verified country tags.
- **Data Passport** — pin datasets across regions and export one reproducible manifest (`data-passport.sh`) with all URLs, Kaggle CLI commands, and `kagglehub` one-liners.
- **Self-refreshing catalog** — a weekly workflow re-verifies every link and pulls freshness from source APIs; the rail shows the last refresh date.
- **Keyboard** — `/` focuses search, `Esc` closes panels, region nodes are Tab/Enter operable.

## Catalog schema

Each entry in `data/catalog.json`:

```json
{
  "title": "…", "description": "…",
  "domain": "climate|health|economy|agriculture|education|transport|energy|demographics",
  "region": "global|north-america|latin-america|europe|africa|middle-east|asia|oceania",
  "source": "Kaggle", "sourceType": "kaggle|intl-org|gov-portal|research|ngo",
  "url": "https://… (deep link to the dataset page)",
  "kaggleRef": "owner/slug (Kaggle only)",
  "formats": ["CSV", "API"], "license": "CC BY 4.0", "licenseOpenness": 0.8,
  "freshnessYear": 2025, "coverageStart": 1960, "coverageEnd": 2024,
  "granularity": "country|admin|city|point|grid", "approxSizeMB": 270,
  "countries": ["IN"]
}
```

`countries` is optional (≤4 ISO alpha-2 codes) and marks datasets specific to identifiable countries — it powers the country-focus behavior on the map.

## Roadmap (from the concept doc)

- **Phase 2 — shipped**: `npm run refresh` + the weekly `refresh.yml` workflow keep links verified and freshness current from source APIs (World Bank, CKAN portals, GitHub, figshare); the UI shows the last refresh date. Remaining: Kaggle API enrichment (needs an API token) and automated new-entry proposals.
- **Phase 3** — full use-case-first entry flow ("I want to…" bundles) and shareable Data Passports.
