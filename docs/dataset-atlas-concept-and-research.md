# The Dataset Atlas — Concept & Research

*A map-first experience for discovering and downloading datasets across domains and regions, in 3 clicks or fewer.*

---

## 1. Problem statement

Anyone with a use case — "I need air-quality data for Indian cities", "GDP series for Latin America", "crop yields for Africa" — must first know *where to look*: Kaggle? A government portal? WHO? World Bank? They then search each site separately, judge quality from inconsistent metadata, create accounts, and hunt for download buttons. A typical discovery-to-download journey costs 15–30 clicks across 3–4 tabs, and datasets outside the user's home region are effectively invisible.

**Goal: a single interface where any user, with any use case, reaches a relevant dataset — view, visit, and download — in ≤3 clicks: Region → Domain → Get.**

## 2. UI/UX research

### Reference: map-first global data presentation ([farmlandatlas.com](https://farmlandatlas.com/))

This reference shows the interaction model we want for presenting all regions of the world at once. What it does, in transferable terms:

**Answer-first map.** Many underlying data layers are collapsed into one weighted index painted directly on a globe/flat map. The user sees a *conclusion* per region before touching any raw data. For our problem: paint each region with a "data availability" signal (count/richness per domain) instead of opening with an empty search box.

**Layers as toggles, not pages.** Every data overlay is one click away in a persistent side rail. The map never reloads; layers swap on top of it. Our equivalent: domain and source filters that re-render the same map instantly.

**Global controls at the top.** Scenario-style controls (time horizon, units) act as global filters over everything. Our equivalents: domain, source type, format/license.

**Zero-friction entry.** No landing page or login wall — the user is inside the tool immediately; sign-in is optional. Critical for a dataset finder, where most visits are one-off lookups.

**Progressive disclosure with presets.** Simple presets for casual users, a custom-weights panel for power users. Our version: curated "use case" presets in front, full filter controls behind.

### Supporting UX research

Findings from dashboard and map-UX literature that shape the design: cognitive load, not aesthetics, is the biggest predictor of dashboard abandonment — users scan in a Z-pattern and abandon screens with more than ~7 competing elements above the fold ([UK Data Services](https://ukdataservices.co.uk/blog/articles/business-intelligence-dashboard-design)). Progressive disclosure — summary first, detail on demand — is the standard remedy ([Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards), [UXPin](https://www.uxpin.com/studio/blog/dashboard-design-principles/)). Map UIs must keep two interaction patterns from fighting each other: exploring the map itself (pan/zoom) versus exploring objects on the map (select/drill) ([Eleken](https://www.eleken.co/blog-posts/map-ui-design)). And effective exploration interfaces pair global filters with click-to-drill so refinement never requires navigation ([Userpilot](https://userpilot.com/blog/data-visualization-ux-best-practices/)).

Design rules we adopt: one persistent map as the stage; at most three filter groups (domain, region, source); every card actionable without leaving the page; counts everywhere so users know what a click will yield before clicking.

## 3. Creative use-case concepts

**A. The Dataset Atlas (recommended — prototyped).** A dark world map where each region is a glowing node sized by dataset count. Domain chips (Climate, Health, Economy, Agriculture, Education, Transport…) filter the map live. Clicking a region opens a card rail of curated datasets, each with a source badge (Kaggle / World Bank / WHO / HDX), format, license, and two actions: **Get data** (direct link) and one-click copy of the `kaggle datasets download` command. Click path: region → domain → Get. Two to three clicks.

**B. Dataset DNA cards.** Every dataset rendered as a compact visual "genome": bars for freshness, coverage years, granularity (country/city/point), size, license openness. Users compare candidates at a glance instead of reading ten metadata pages.

**C. Use-case-first entry ("I want to…").** The user picks an intent — "forecast crop yield", "study disease outbreaks", "build a housing-price model" — and the atlas pre-selects the domain, highlights regions with usable data, and bundles the 3–5 datasets that use case needs into one download list.

**D. Data Passport.** A shareable collection: pin datasets from multiple regions/sources, then export a manifest (URLs + Kaggle CLI script) that reproduces the whole download on any machine — for teams and reproducible research.

**E. Coverage heatmap ("where data is missing").** Invert the signal: paint regions by data *scarcity* per domain. Valuable for NGOs, researchers, and competition organizers deciding where new data collection matters most.

**F. Kaggle-native version.** Publish the atlas as a Kaggle notebook + dataset: the curated catalog lives as a CSV dataset on Kaggle, and an interactive notebook (Plotly map) lets any Kaggler explore and pull sources with `kagglehub` in one line. Zero hosting cost, native audience.

## 4. Low-click download mechanics

For Kaggle sources, three progressively lighter paths exist. The web path is dataset page → Download button (login required). The CLI path is one copyable command, `kaggle datasets download -d owner/slug`, after a one-time API-token setup ([docs](https://www.kaggle.com/docs/api), [official CLI](https://github.com/Kaggle/kaggle-cli)). The Python path is `kagglehub.dataset_download("owner/slug")` — one line, auto-caching. The atlas puts a copy button for the CLI command on every Kaggle card, so download is one click plus paste.

For open portals, cards deep-link to the specific dataset or query page (never the portal home), so the user lands one click from the file. Portals like World Bank, HDX, and data.gov expose direct CSV/API URLs that can be linked outright — zero clicks after the card.

## 5. Source catalog — by domain and region

### Global / multi-domain anchors

| Source | Coverage | Access |
|---|---|---|
| [Kaggle Datasets](https://www.kaggle.com/datasets) | ~400k datasets, all domains | Web, CLI, `kagglehub` |
| [Google Dataset Search](https://datasetsearch.research.google.com/) | Meta-search across repositories | Web |
| [World Bank Open Data](https://data.worldbank.org/) | Economy, health, education, environment — every country | Web, API, CSV |
| [UN Data](https://data.un.org/) | UN statistical databases | Web, API |
| [Our World in Data](https://ourworldindata.org/) | Curated global indicators, all charts downloadable | Web, CSV, GitHub |
| [Registry of Open Data on AWS](https://registry.opendata.aws/) | Petabyte-scale scientific/geospatial data | S3, STAC |
| [HDX — Humanitarian Data Exchange](https://data.humdata.org/) | Crisis, population, food security; strong Africa/Asia coverage | Web, API |

### Climate & environment

| Source | Region | Notes |
|---|---|---|
| [Copernicus Climate Data Store](https://cds.climate.copernicus.eu/) | Global/Europe | ERA5 reanalysis, projections |
| [NASA Earthdata](https://earthdata.nasa.gov/) | Global | Satellite, land, atmosphere |
| [NOAA Climate Data](https://www.ncei.noaa.gov/) | Global/US | Station records, ocean |
| [FAOSTAT](https://www.fao.org/faostat/) | Global | Agriculture, land use, food |
| [Berkeley Earth surface temperature on Kaggle](https://www.kaggle.com/datasets/berkeleyearth/climate-change-earth-surface-temperature-data) | Global | Temperature since 1750 |
| [USGS Earthquakes on Kaggle](https://www.kaggle.com/datasets/usgs/earthquake-database) | Global | Significant earthquakes |

### Health & demographics

| Source | Region | Notes |
|---|---|---|
| [WHO Global Health Observatory](https://www.who.int/data/gho) | Global | Disease, mortality, health systems |
| [IHME GHDx](https://ghdx.healthdata.org/) | Global | Global Burden of Disease |
| [Life Expectancy (WHO) on Kaggle](https://www.kaggle.com/datasets/kumarajarshi/life-expectancy-who) | Global | Ready-to-model CSV |
| [DHS Program](https://dhsprogram.com/data/) | Africa/Asia/LatAm | Household health surveys |

### Economy & finance

| Source | Region | Notes |
|---|---|---|
| [IMF Data](https://www.imf.org/en/Data) | Global | Macro, exchange, debt |
| [OECD Data Explorer](https://data-explorer.oecd.org/) | OECD members | Comparable indicators |
| [World Development Indicators on Kaggle](https://www.kaggle.com/datasets/theworldbank/world-development-indicators) | Global | World Bank flagship, Kaggle mirror |
| [Kiva Crowdfunding on Kaggle](https://www.kaggle.com/datasets/kiva/data-science-for-good-kiva-crowdfunding) | Developing regions | Microfinance loans |

### Regional portals

| Region | Portals |
|---|---|
| North America | [data.gov](https://data.gov/) (US), [open.canada.ca](https://open.canada.ca/), [datos.gob.mx](https://datos.gob.mx/) |
| Europe | [data.europa.eu](https://data.europa.eu/), [Eurostat](https://ec.europa.eu/eurostat), [data.gov.uk](https://www.data.gov.uk/) |
| Asia | [data.gov.in](https://data.gov.in/) (India), [data.gov.sg](https://data.gov.sg/) (Singapore), [data.go.jp](https://www.data.go.jp/) (Japan), [data.go.kr](https://www.data.go.kr/) (Korea) |
| Africa | [openAFRICA](https://open.africa/), [Africa Information Highway](https://dataportal.opendataforafrica.org/), [NBER Sub-Saharan portal](https://www.nber.org/research/data/portal-public-use-datasets-sub-saharan-africa) |
| Latin America | [CEPALSTAT](https://statistics.cepal.org/), [GeoSUR](https://www.geosur.info/), [datos.gob.ar](https://datos.gob.ar/) |
| Oceania | [data.gov.au](https://data.gov.au/), [data.govt.nz](https://data.govt.nz/) |
| Directory of all portals | [dataportals.org](https://dataportals.org/) |

## 6. Recommended build path

Phase 1: static curated catalog (~100 hand-picked datasets) + the map UI in the prototype — ship as a single-page site or a Kaggle notebook. Phase 2: auto-enrich via the Kaggle API (`datasets_list(search=…)`) and HDX/World Bank APIs so counts and freshness update themselves. Phase 3: add the Data Passport export and the use-case-first entry flow.

The interactive prototype accompanying this document implements Concept A with elements of B and D.

---

*Sources: [UI/UX reference](https://farmlandatlas.com/), [Kaggle API docs](https://www.kaggle.com/docs/api), [Kaggle CLI](https://github.com/Kaggle/kaggle-cli), [Pencil & Paper — dashboard UX patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards), [UK Data Services — BI dashboard UX](https://ukdataservices.co.uk/blog/articles/business-intelligence-dashboard-design), [UXPin — dashboard design principles](https://www.uxpin.com/studio/blog/dashboard-design-principles/), [Eleken — map UI design](https://www.eleken.co/blog-posts/map-ui-design), [Userpilot — data visualization UX](https://userpilot.com/blog/data-visualization-ux-best-practices/), [Registry of Open Data on AWS](https://registry.opendata.aws/), [dataportals.org](https://dataportals.org/), [State of Open Data — regions](https://www.stateofopendata.od4d.net/chapters/regions/introduction.html).*
