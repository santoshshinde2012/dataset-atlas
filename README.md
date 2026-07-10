# The Dataset Atlas

**A map-first experience for discovering and downloading datasets — in 3 clicks or fewer: Region → Domain → Get.**

**Live demo:** https://santoshshinde2012.github.io/dataset-atlas/

155 curated, link-verified datasets · 8 domains · 7 world regions + global (every domain×region cell ≥ 2 datasets) · country-level focus · light & dark themes · self-refreshing catalog · zero dependencies.

Instead of knowing *where to look* (Kaggle? World Bank? WHO? a national portal?), you start from a world map painted by data availability, filter by domain with one click, and every dataset card gives you a direct **Get data** link plus a one-click copy — the `kaggle datasets download` command for Kaggle sources, or the dataset link for everything else.

The UI/UX follows the interaction model of [farmlandatlas.com](https://farmlandatlas.com/): an answer-first map as the persistent stage, layers/filters as toggles in a side rail (never page navigation), global controls on top, zero-friction entry (no landing page, no login), and progressive disclosure (use-case presets in front, full filters behind).

---

## Quick start

```bash
git clone https://github.com/santoshshinde2012/dataset-atlas.git
cd dataset-atlas
npm start          # serves on http://localhost:4173 (python3 http.server)
```

No build step, no `npm install` — the app is dependency-free ES modules with D3 vendored locally, so it also works fully offline.

```bash
npm test           # 42 unit tests (node --test, Node >= 22)
npm run validate   # schema-check data/catalog.json after editing it
npm run refresh    # liveness sweep + source-API freshness bumps + refresh stamp
```

## Using the atlas

1. **Pick a region** — click a glowing region node, any country, or the **Global** pill. The globe animates to it and the card rail opens. (Nodes are keyboard-operable: Tab + Enter.)
2. **Pick a domain** — the floating dock over the map keeps all eight domains (plus All) visible at every width as icon + live count; the active chip expands its label and the whole map recolors in that domain's hue. In "All domains" mode each region node wears a ring of its domain mix.
3. **Get the data** — every card has **Get data** (deep link straight to the dataset page) and **Copy CLI** / **Copy link** with an in-place "Copied" confirmation.

Power features:

- **Country focus** — click a specific country (say, India) and its datasets sort to the top of the region rail with a country badge; the hover tooltip shows the country-specific count. 85 entries carry verified country tags.
- **Dataset DNA** — the five-bar strip on each card compares freshness, coverage span, granularity, size, and license openness at a glance (tap a bar for the detail).
- **Data Passport** — pin datasets across regions, then export one reproducible `data-passport.sh` manifest with all URLs, Kaggle CLI commands, and `kagglehub` one-liners.
- **Filters rail** — use-case presets ("I want to… forecast crop yields"), source type, format, license-openness slider, and search (`/`). When the rail is collapsed, a badge shows how many filters are active.
- **Themes** — light (default) and dark, one click on the sun/moon toggle, remembered across visits. Both palettes are validated for colorblind-safe separation and surface contrast.
- **Keyboard** — `/` focuses search, `Esc` closes panels, Tab/Enter selects regions. Reduced-motion preferences disable the ambient globe rotation and animations.

## What's inside

| Piece | Purpose |
|---|---|
| `index.html`, `styles.css` | Markup and the token-driven theme (light default, dark override block) |
| `js/` | The app as SOLID ES modules (see Architecture) |
| `tests/` | Unit tests for the pure logic modules, including theme-drift guards |
| `data/catalog.json` | The curated dataset catalog (multi-agent curated, every URL verified twice) |
| `data/world-110m.json` | World country shapes (TopoJSON, from world-atlas) |
| `data/country-regions.json` | ISO-numeric country code → atlas region |
| `data/country-codes.json` | ISO-numeric → alpha-2 code + display name (country focus) |
| `scripts/` | Catalog validator and the liveness/freshness refresh job |
| `vendor/` | Local copies of D3 v7 and topojson-client (works offline) |
| `.github/workflows/` | CI, GitHub Pages deploy, weekly catalog refresh |
| `docs/` | Concept & research, system design, free-cloud deployment guide |

## Architecture

Dependency-free ES modules with a small pub/sub store at the center; `js/main.js` is the composition root that wires everything (components never import each other):

```
js/
  config.js          registries: domains, regions, source types, presets, THEMES
  icons.js           inline SVG icon registry (stroke style, no emoji)
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
  ui/                topbar, domain dock, filter rail, card rail, passport drawer, tooltip
  main.js            composition root: builds store + services, injects them
```

How SOLID lands here: each module has one reason to change (**S**); new domains, presets, regions, themes, and projections are registry entries, not code edits (**O**); both projection strategies satisfy one interface the map consumes blindly (**L**); components depend on the store's narrow `getState/select/actions/subscribe` surface (**I**); and persistence/clipboard/notifications are injected ports, so the store is unit-testable with fakes (**D**).

**Theming** is token-driven: `js/config.js` holds a `THEMES` registry (accent, choropleth ramp, per-domain colors — palettes validated with a six-checks color validator against each surface) and `styles.css` mirrors it as CSS custom properties (`:root` = light, `[data-theme="dark"]` = overrides). A CI test fails if the two drift.

## Editing the catalog

Each entry in `data/catalog.json`:

```json
{
  "title": "…", "description": "…",
  "domain": "climate|health|economy|agriculture|education|transport|energy|demographics",
  "region": "global|north-america|latin-america|europe|africa|middle-east|asia|oceania",
  "source": "World Bank", "sourceType": "kaggle|intl-org|gov-portal|research|ngo",
  "url": "https://… (deep link to the dataset page, never a portal homepage)",
  "kaggleRef": "owner/slug (Kaggle only)",
  "formats": ["CSV", "API"], "license": "CC BY 4.0", "licenseOpenness": 0.8,
  "freshnessYear": 2025, "coverageStart": 1960, "coverageEnd": 2024,
  "granularity": "country|admin|city|point|grid", "approxSizeMB": 270,
  "countries": ["IN"]
}
```

- `countries` is optional (≤4 ISO alpha-2 codes) and powers country focus — tag only datasets specific to identifiable countries.
- After any edit, run `npm run validate` (duplicate URLs, kaggleRef↔URL consistency, coverage sanity, and the domain×region coverage matrix). CI runs it on every push, so a broken catalog can never deploy.

## CI/CD and the self-refreshing catalog

Three GitHub Actions workflows ship with the repo:

- **CI** (`ci.yml`) — syntax-checks every module, runs the test suite and the catalog validator on each push and PR.
- **Deploy** (`deploy-pages.yml`) — publishes the repo root to GitHub Pages on every push to `main`; it creates the Pages site itself on first run.
- **Refresh** (`refresh.yml`) — weekly (and on demand): re-verifies every dataset URL, pulls last-modified dates from source APIs (World Bank, CKAN portals, GitHub, figshare), stamps the catalog, and opens a review PR when anything changed. Dead links turn the run red. The rail shows "Catalog refreshed \<date\>" so users see the data's age.

One repo setting is required for refresh PRs: **Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests."**

## Deploying (free)

Point any static host at the repo root — GitHub Pages is wired up already; Cloudflare Pages, Netlify, and Vercel each take ~2 minutes. Full walkthroughs, verification checklist, and cost notes: [docs/deployment-free-cloud.md](docs/deployment-free-cloud.md).

## Documentation

| Doc | Contents |
|---|---|
| [docs/dataset-atlas-concept-and-research.md](docs/dataset-atlas-concept-and-research.md) | The concept, UX research, and source catalog behind the design |
| [docs/system-design.md](docs/system-design.md) | Architecture, data model, curation pipeline, security model, testing, roadmap |
| [docs/deployment-free-cloud.md](docs/deployment-free-cloud.md) | Zero-cost deployment on four hosts, step by step |
| [CLAUDE.md](CLAUDE.md) | Working conventions for the codebase |

## Roadmap

- **Phase 2 — shipped**: weekly liveness + freshness refresh with review PRs; remaining: Kaggle API enrichment (needs an API token) and automated new-entry proposals.
- **Phase 3** — use-case bundles ("I want to…" flows that pre-assemble a passport) and shareable passports (pins in the URL hash).
