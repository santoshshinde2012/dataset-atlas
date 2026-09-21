# Join kits and screening rules

The atlas does not invent analysis. It tells you whether two reviewed sources can be used together, and at what grain. A **match** is screening evidence, not a statistical guarantee.

## When a join is allowed

`match` only if a **verified kit** in [`js/kits.js`](../js/kits.js) covers the pair (runnable notebook, checked keys) **and** `outcome` is `join`.

Matching column names (`iso_code`, `year`, `district`) are **not** enough. That result stays `review`. `outcome: do-not-join` is a **refusal**, not a maybe.

## Identifier pack

Country-year files mix countries with silent totals. Before joining, classify every code with [`js/identifiers.js`](../js/identifiers.js) (MCP: `check_identifiers`):

| Keep | Drop |
|---|---|
| ISO-2 / ISO-3 countries (`IN` → `IND`) | World Bank aggregates (`WLD`, `EUU`, `SAS`, `HIC`, …) |
| | OWID aggregates (`OWID_WRL`, `OWID_EUR`, …) |
| | Blank ISO, `World`, continent names |

Unknown is not a country. Do not guess a code from a display name.

## Units and vintage

Same ISO-3 + year can still be the wrong number. Classify with [`js/units.js`](../js/units.js) and [`js/vintage.js`](../js/vintage.js) (MCP: `check_units`, `check_vintage`). These modules **never convert**.

| Keep separate | Why |
|---|---|
| TWh vs million tonnes | Energy vs mass |
| Current US$ vs PPP | Market FX vs international dollars |
| WDI year vs calendar year | Australia 2022 GDP is FY 2021–22 |
| WB `SP.POP.TOTL` vs OWID population | Mid-year mix vs OWID-harmonised series |
| Census 2011 codes vs LGD | Different vintage |

## Current kits

| Kit | Outcome | Result grain | Rule |
|---|---|---|---|
| Energy use vs CO₂ | join | country-year | Drop rows without ISO-3 (and `WLD` / `OWID_WRL`). Join `iso_code` + `year`. Energy is TWh; `co2` is million tonnes. Notebook: [`data/energy-co2-example.ipynb`](../data/energy-co2-example.ipynb) |
| India crop + rainfall | join | **subdivision**, not district | Map district → IMD subdivision, aggregate production, sum monthly rainfall to year, inner-join on subdivision + year. Unmatched districts are dropped. Crosswalk: [`data/india-district-subdivision.json`](../data/india-district-subdivision.json) |
| COVID-19 vs population | join | country-year | Sum daily `new_cases` to calendar year, drop aggregates, join World Bank `SP.POP.TOTL` on ISO-3 + year. Population is a **mid-year** estimate — not OWID population. Notebook: [`data/covid-population-example.ipynb`](../data/covid-population-example.ipynb) |
| OWID CO₂ per capita | join | country-year | Join OWID `co2` to **OWID** population only. Tonnes/person = `co2 * 1e6 / population`. Do not use `SP.POP.TOTL`. |
| OpenAQ stations vs national PM2.5 | **do-not-join** | station | Station-hour points are not a city or national AQI. Intra-city readings can differ more than 5×. |
| Nigeria COD-AB + COD-PS | join | admin1 (state) | Inner-join on `adm1_pcode`, not state name. Crosswalk: [`data/nga-pcode-admin1.json`](../data/nga-pcode-admin1.json) |
| WDI GDP (current US$) vs OWID CO₂ | **do-not-join** | country | Keys match; current US$ is not PPP; FY reporters are not calendar year. |
| India LGD | join | current LGD district | Ahmednagar and Ahilyanagar share LGD `466`. Census 2011 `522` is not LGD. Unmatched names dropped. Crosswalk: [`data/india-lgd-district.json`](../data/india-lgd-district.json) |
| CHIRPS grid vs IMD rainfall | **do-not-join** | grid | 0.05° cell ≠ meteorological subdivision. Do not average to a district name. |

## Do not

- Do not join on country **names** when ISO-3 exists.
- Do not keep aggregate rows (`World`, continent totals, `WLD`, `OWID_WRL`).
- Do not join India crop to rainfall on **district name**, or treat the result as district-level.
- Do not join a **daily** COVID row to **annual** population.
- Do not mix World Bank population with OWID population in the same per-capita.
- Do not average OpenAQ stations into a city or national AQI.
- Do not join Nigeria COD files on state **name**.
- Do not treat current US$ GDP / CO₂ as intensity, or FY year labels as calendar years.
- Do not treat Census 2011 codes as LGD.
- Do not join CHIRPS grid cells to IMD subdivisions.
- Do not invent a file URL from a landing page.
- Do not treat an unspecified license as public domain.
- Do not write join code when `recommend_kit` is empty.

## Honest fields

| Claim | Meaning |
|---|---|
| Download file / Open API | A checked `resources[]` distribution exists |
| Open source | Landing page only; Kaggle stays page + CLI |
| Tagged country | The entry lists that ISO-2 |
| Global country-year series | Candidate when a country is focused; not a proven extract |
| Link checked | URL responded; not a quality stamp |
| Reuse labels | Screening only; confirm at the source |

Workbench fit lives in [`js/fit.js`](../js/fit.js). Pilot evidence lives in [`data/pilot.json`](../data/pilot.json). Add a kit only after the [contributing](../CONTRIBUTING.md) checks pass.
