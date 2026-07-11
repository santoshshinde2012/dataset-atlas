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
npm test           # 64 unit tests (node --test, Node >= 22)
npm run validate   # schema-check data/catalog.json after editing it
npm run refresh    # liveness sweep + source-API freshness bumps + refresh stamp
```

## Using the atlas

1. **Pick a region** — click a glowing region node, any country, or the **Global** pill. The globe animates to it and the card rail opens. (Nodes are keyboard-operable: Tab + Enter.)
2. **Pick a domain** — the floating dock over the map keeps all eight domains (plus All) visible at every width as icon + live count; the active chip expands its label and the whole map recolors in that domain's hue. In "All domains" mode each region node wears a ring of its domain mix.
3. **Get the data** — every card has **Get data** (deep link straight to the dataset page) and **Copy CLI** / **Copy link** with an in-place "Copied" confirmation.

Power features:

- **Country focus** — click a specific country (say, India) and its datasets group to the top of the region rail with a country badge; a Country selector makes the same move keyboard-friendly. 85 entries carry verified country tags.
- **Shareable URLs** — every view (domain, region, country, filters, sort, projection) lives in the URL hash: bookmark it, cite it, send it. The Passport's *Share link* even carries your pinned collection to a colleague.
- **Search anywhere** — type with no region selected and a results rail opens grouped by region; no dead ends.
- **Compare tray** — shortlist up to four datasets and see them side by side (license, coverage, granularity, size, access) with download one click away.
- **Dataset DNA & provenance** — the five-bar strip compares freshness, coverage span, granularity, size, and license openness; shield badges show when each link was last verified by the daily pipeline, and lock badges warn about account/sign-up walls *before* you click out. "About this data" explains the whole pipeline in-app.
- **Data Passport** — pin datasets across regions, then export a reproducible `data-passport.sh` manifest and a `references.bib` (per-card BibTeX copy too).
- **Starter bundles** — each "I want to…" preset carries 5 curated datasets; one click pins the whole kit into your Passport, ready to export (bundle links are CI-validated against the catalog).
- **Filters rail** — use-case presets, source type, format, license-openness slider, search (`/`), a sort control (freshness/coverage/openness/size/A–Z), and a "new or updated since your last visit" filter powered by the daily refresh. A badge shows active-filter count when the rail is collapsed; empty states offer removable filter chips.
- **Mobile-first ergonomics** — bottom-sheet panels with swipe-to-dismiss, pinch/double-tap/button zoom, always-visible dock labels, and safe-area-aware chrome.
- **Themes** — light (default) and dark, one click, remembered. Both palettes validated for colorblind-safe separation and surface contrast.
- **Keyboard & screen readers** — `/` focuses search, `Esc` closes panels in order, Tab/Enter selects regions, focus lands in opened panels, and filter changes are announced via a live region. Reduced motion disables rotation and animations.
- **First-visit guide** — a one-time three-step card with a "Try India" shortcut.

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
| `scripts/` | Catalog validator, the liveness/freshness refresh job, and the `atlas-mcp.js` agent server |
| `.mcp.json`, `.claude/skills/` | The MCP server registration and the `expedition` agent skill |
| `vendor/` | Local copies of D3 v7 and topojson-client (works offline) |
| `.github/workflows/` | CI, GitHub Pages deploy, daily catalog refresh |
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
- **Refresh** (`refresh.yml`) — **daily** (and on demand): re-verifies every dataset URL, pulls last-modified dates from source APIs (World Bank, CKAN portals, GitHub, figshare — plus Kaggle when the optional secrets are set), and stamps the catalog. Safe metadata updates commit straight to `main` behind the validate + test gate and auto-deploy; **dead links open a review PR** and turn the run red. The rail shows "Catalog refreshed \<date\>" so users always see the data's age.

Two optional one-time settings:
- Refresh PRs need **Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests."**
- Kaggle freshness needs repo secrets `KAGGLE_USERNAME` and `KAGGLE_KEY` (from [kaggle.com/settings](https://www.kaggle.com/settings) → Create New Token). Without them the Kaggle adapter simply skips.

## Agent interface (MCP)

The same curated catalog is also a tool an AI agent can use. [`scripts/atlas-mcp.js`](scripts/atlas-mcp.js) is a single-file, **zero-dependency** stdio [MCP](https://modelcontextprotocol.io) server (no `npm install`) that turns any plain-language goal into a ready-to-use dataset collection. It exposes four tools, each backed by the app's own pure modules — so an agent's output is byte-identical to what the UI produces:

| Tool | Does |
|---|---|
| `search_catalog` | Faceted, ranked query (domain, region, country, license, format, size) with per-dataset DNA scores |
| `get_dataset` | Full metadata + DNA detail + the download command + a share link for one entry |
| `list_bundles` | The curated "I want to…" starter kits (5 datasets each) |
| `build_passport` | A list of ids → a reproducible `data-passport.sh`, a `references.bib`, and a pre-pinned atlas share link |

It's registered in [`.mcp.json`](.mcp.json), so **Claude Code auto-discovers it** in this repo. The same config block works for Claude Desktop and Agent SDK agents:

```json
{ "mcpServers": { "dataset-atlas": { "command": "node", "args": ["scripts/atlas-mcp.js"] } } }
```

The [`expedition`](.claude/skills/expedition/SKILL.md) skill drives the tools through a six-step flow — clarify the use case → search → rank by DNA → assemble → package → hand off. Ask it *"find me data to analyze renewable energy adoption across Europe"* and it returns a shortlist, a download script, and citations. The atlas supplies verified ground truth; the agent supplies judgment.

## Deploying (free)

Point any static host at the repo root — GitHub Pages is wired up already; Cloudflare Pages, Netlify, and Vercel each take ~2 minutes. Full walkthroughs, verification checklist, and cost notes: [docs/deployment-free-cloud.md](docs/deployment-free-cloud.md).

## Documentation

| Doc | Contents |
|---|---|
| [docs/dataset-atlas-concept-and-research.md](docs/dataset-atlas-concept-and-research.md) | The concept, UX research, and source catalog behind the design |
| [docs/system-design.md](docs/system-design.md) | Architecture, data model, curation pipeline, security model, testing, catalog lifecycle |
| [docs/deployment-free-cloud.md](docs/deployment-free-cloud.md) | Zero-cost deployment on four hosts, step by step |
| [CLAUDE.md](CLAUDE.md) | Working conventions for the codebase |
