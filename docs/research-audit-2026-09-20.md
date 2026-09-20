# Dataset Atlas: product and data audit

20 September 2026 · Research and read-only testing against `main` at `117569c` and the published GitHub Pages site.

## Executive finding

The atlas is a sound static discovery prototype with 171 curated links, useful source filters, saved selections, and a 15-source research pilot. Its central promise is not yet consistently delivered: a user can often find a source page, but usually cannot tell whether that source contains the exact geography, dates, variables, usable file, and join keys they need. Expanding the count alone will make this problem harder. The next product milestone should be **a reliable path from a question to a verified, accessible resource**.

This audit used the repository and deployed pages, a small reproducible query and browser check, and primary documentation from W3C, Google, World Bank, Data.gov, and HDX. It did not include user interviews, a full link-content review of all 171 sources, or a legal review of every license. Counts below describe the checked revision and may change after a catalog refresh.

## What was measured

| Measure | Finding | Implication |
|---|---:|---|
| Catalog entries | 171 | A deliberately small index compared with major provider catalogs; the UI should say “curated” and offer wider search. |
| Entries in the research pilot | 15 | Fit and access detail is limited to a small subset. |
| Pilot profiles with a direct resource URL | 6 of 15 | Most handoffs still end at a landing page. |
| Pilot profiles with documented columns | 6 of 15 | Pair comparisons lack schema evidence for most sources. |
| Pilot profiles with source sample rows | 3 of 15 | Previews are sparse and static. |
| Catalog entries without a successful-link date | 20 of 171 | Link status is unknown or blocked for these entries, even when a source API responded. |
| Catalog entries with `freshnessYear > coverageEnd` | 85 of 171 | The “freshness” score and its definition need a field-by-field review; this is a mismatch, not proof that 85 records are wrong. |
| Regional entries shown for Asia vs global entries excluded from that view | 18 vs 52 | A user browsing India can miss relevant global country-level datasets. |

The catalog counts were computed from `data/catalog.json` and `data/pilot.json`. The pilot's three tasks have different completion levels: the energy/CO₂ task has one tested country-year notebook; the India crop/rainfall task still needs a district-to-meteorological-subdivision crosswalk; the COVID/population task needs a documented daily-to-annual alignment rule. The workbench should distinguish a usable pair from a pair that merely shares a broad time range.

## Observed user journeys

1. **Natural-language search misses known entries.** Search uses one lowercased substring over title, description, source, domain, and region (`js/filters.js`). In the checked catalog, `India crop production`, `air quality India cities`, `crop rainfall district`, and `energy CO2 India` each returned **zero** results. Reversing the word order can hide an existing source. The external-catalog links help users leave the atlas but do not repair local recall.
2. **Country browsing hides global data.** `regionDatasets()` filters on `d.region === region` (`js/store.js`). Selecting Asia and then India ranks the India-tagged entries in Asia, while 52 global entries are in a separate view. Country coverage for many global entries is not documented, so the fix requires explicit country availability rather than assuming every global series covers India.
3. **“Get data” usually means “open source page.”** The main card action uses `d.url`, a landing page (`js/ui/card-rail.js`). That is honest as a link, but the label suggests direct data access. W3C DCAT distinguishes a dataset landing page, an access URL, and a direct download URL; those should be separate fields and actions. The Data Passport currently exports executable commands for Kaggle only.
4. **The fit screen can overstate join readiness.** `assessJoin()` (`js/fit.js`) can return `match` for same-level, same-time-grain sources with a shared key name even when country coverage is unknown. Matching key *names* does not establish compatible identifiers, units, definitions, completeness, or one-to-one cardinality. A `match` should require verified overlap and a documented transformation or be labelled “candidate.”
5. **Mobile and keyboard paths need repair.** In a Chromium check at 320, 360, and 390 CSS pixels, the right edge of the Passport button was at x=403; it was clipped by 83, 43, and 13 pixels respectively. In the workbench, focus left the `aria-modal="true"` dialog after 26 Tab presses and reached `body`. [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) expects no loss of function at 320 CSS pixels, and the [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) keeps Tab focus inside the active dialog.
6. **External discovery is limited.** The live root page had no dataset JSON-LD or canonical link; `/sitemap.xml` returned 404. Google recommends canonical dataset pages, `Dataset` structured data, source identity links, and a sitemap for repositories. Indexing is never guaranteed, but the current single-page structure gives crawlers little dataset-specific content. See [Google's dataset guidance](https://developers.google.com/search/docs/appearance/structured-data/dataset).

## What current standards and providers imply

- [DCAT 3](https://www.w3.org/TR/vocab-dcat-3/) separates a dataset from each distribution. It can express landing page, access service, download URL, file format, size, temporal coverage, temporal resolution, and update frequency. Atlas currently flattens most of these into one dataset URL, a format list, a single year range, and an estimated size. A distribution model is the prerequisite for reliable “download” actions and previews.
- The [FAIR principles](https://www.gofair.foundation/fair-principles) call for rich metadata, clear access conditions, provenance, and a reuse license. A successful HTTP response is only link health; it does not establish that a file can be used or combined. The atlas already makes this distinction in its README, but the UI needs to surface it more consistently.
- [HDX metadata guidance](https://centre.humdata.org/providing-metadata-for-your-datasets-on-hdx/) distinguishes dates, location, methodology, update frequency, caveats, and resource-level file types. Its [search API](https://centre.humdata.org/ufaqs/about-the-humanitarian-data-exchange-api/) exposes dataset and resource metadata, but does not generally query the content of resources. This supports an import-and-review workflow, not an assumption that API search results are ready-to-use data.
- The [World Bank API](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581) supports country and date queries, CSV ZIP downloads, and pagination without an API key. A one-page sample endpoint is not a full download. The current pilot correctly warns about pagination, but its exported resource URL is only page one. Build a complete country/date query or explicit all-pages recipe for handoff.
- The current [Data.gov Catalog API](https://resources.data.gov/catalog-api/) replaces the older CKAN API for new integrations and requires an API key. A static browser app should use its public search page or import selected metadata at build time with a secret held in CI; it must not embed a production key in client code. In contrast, the World Bank API needs no key. Provider records should be marked **external/unreviewed** until validated.

## Recommended build order

| Priority | Change | Concrete acceptance test |
|---|---|---|
| P0 | Fix 320px navigation and modal focus; add mobile and keyboard browser tests. | All top actions remain reachable at 320px; Tab/Shift+Tab stay inside the open workbench; focus returns to its trigger on close. |
| P0 | Replace exact substring matching with normalized token search and ranked title/variable/geography matches. Preserve source labels and explain why each result matched. | `India crop production` returns the known India crop entries; `air quality India cities` offers relevant air-quality entries or a clear wider-search path; no unrelated source outranks an exact title. |
| P1 | Introduce a distribution and provenance schema: `landingPage`, `resources[]`, access requirements, provider ID, observed coverage, date checked, license source, and unknown states. | A card differentiates “Open source” from “Download CSV/API”; exports include the full resource/recipe and evidence. Missing data is shown as unknown, never guessed. |
| P1 | Repair country discovery and fit claims. Combine verified global-country candidates with regional results and retain a visible coverage-confidence label. Require country overlap, time/geo alignment, units, and cardinality evidence before a pair is called verified. | An India search can find applicable World Bank/OWID sources; unknown coverage produces “review” instead of “match”; incompatible pairs stay blocked. |
| P1 | Finish one end-to-end task outside energy: choose crop/rainfall with a sourced geographic crosswalk or COVID/population with a documented temporal conversion, then add a reproducible notebook and validation. | A user can download the named resources, run the notebook, and reproduce a small checked output without inventing keys or units. |
| P2 | Add canonical, crawlable pages for the curated datasets with correct `sameAs`, schema.org `Dataset` metadata, and a generated sitemap. | Each page serves useful human text without JavaScript; structured data matches the visible source/version/license; sitemap URLs return 200. |
| P2 | Federate selected provider metadata with a staging/review queue and source-specific adapters. Keep external results separate from curated results. | Search covers selected World Bank and HDX queries without inflating curated map counts; duplicates collapse by stable provider ID; failures degrade to the provider link. |

**Suggested success measures:** percentage of task searches finding a relevant candidate in the first five results; percentage of curated entries with verified resource-level access; percentage of reviewed pairs with executable evidence; share of users reaching a real file or API; mobile action reachability; and stale-link resolution time. Track these against a fixed set of realistic questions before increasing catalog size.

## Data integrity decisions before further growth

1. Define `coverageStart/End` as observations, publication span, or forecast horizon, with separate fields where these differ. Define `freshnessYear` separately from last HTTP check and last provider update. The current [DNA bar](../js/dna.js) says “data last updated” even though 85 entries have a later freshness year than their coverage end. Review those records before sorting users by that bar.
2. Avoid treating URL uniqueness as dataset uniqueness. Two current entries point to different Eurostat pages for the same `apro_cpsh1` series. Canonical provider identifiers would permit safe deduplication while retaining alternate resource links.
3. Separate citation year from content year. Current [BibTeX generation](../js/citation.js) uses `freshnessYear` as publication year, which can misstate a source's edition. Prefer publisher, title, persistent ID/version, publication date if known, access date, and a source citation supplied by the provider. [DataCite's schema](https://schema.datacite.org/) is a useful reference.
4. Keep the atlas's claim bounded. At the time of this audit, the World Bank Indicators API reported roughly 29,500 indicator metadata records and HDX search reported roughly 28,000 datasets; those are dynamic provider counts, not a target for indiscriminate import. The product's defensible advantage is trustworthy fit and access evidence across providers, with a clear route to search beyond the curated index.

## Research limits and reproduction

The query test used the app's current lowercased whole-string match on `title + description + source + domain + region`. The browser check used local `dist/` at 320/360/390 CSS pixels and a keyboard Tab walk after opening the workbench. The live HTTP check confirmed the absence of `sitemap.xml` and dataset JSON-LD on the root page. The source comparison used public documentation, not private APIs or a full crawl of provider records. This report identifies product risks and a testable implementation sequence; it does not certify the accuracy of every catalog record.
