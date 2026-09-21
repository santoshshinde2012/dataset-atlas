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

## Current kits

| Kit | Outcome | Result grain | Rule |
|---|---|---|---|
| Energy use vs CO₂ | join | country-year | Drop rows without ISO-3 (and `WLD` / `OWID_WRL`). Join `iso_code` + `year`. Energy is TWh; `co2` is million tonnes. Notebook: [`data/energy-co2-example.ipynb`](../data/energy-co2-example.ipynb) |
| India crop + rainfall | join | **subdivision**, not district | Map district → IMD subdivision, aggregate production, sum monthly rainfall to year, inner-join on subdivision + year. Unmatched districts are dropped. Crosswalk: [`data/india-district-subdivision.json`](../data/india-district-subdivision.json) |
| COVID-19 vs population | join | country-year | Sum daily `new_cases` to calendar year, drop aggregates, join World Bank `SP.POP.TOTL` on ISO-3 + year. Population is a mid-year estimate. Notebook: [`data/covid-population-example.ipynb`](../data/covid-population-example.ipynb) |
| OpenAQ stations vs national PM2.5 | **do-not-join** | station | Station-hour points are not a city or national AQI. Intra-city readings can differ more than 5×. Report min/median/max at the station; never average into World Bank `EN.ATM.PM25.MC.M3`. Notebook: [`data/openaq-station-example.ipynb`](../data/openaq-station-example.ipynb) |
| Nigeria COD-AB + COD-PS | join | admin1 (state) | Inner-join on `adm1_pcode`, not state name (`Lagos` vs `Lagos State`). Do not mix admin1 and admin2 P-codes. Crosswalk: [`data/nga-pcode-admin1.json`](../data/nga-pcode-admin1.json) |

## Do not

- Do not join on country **names** when ISO-3 exists.
- Do not keep aggregate rows (`World`, continent totals, `WLD`, `OWID_WRL`).
- Do not join India crop to rainfall on **district name**, or treat the result as district-level.
- Do not join a **daily** COVID row to **annual** population.
- Do not average OpenAQ stations into a city or national AQI.
- Do not join Nigeria COD files on state **name**.
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
