# Join kits and screening rules

The atlas does not invent analysis. It tells you whether two reviewed sources can be used together, and at what grain. A **match** is screening evidence, not a statistical guarantee.

## When a join is allowed

`match` only if at least one of these is true:

1. A **verified kit** in [`js/kits.js`](../js/kits.js) covers the pair (runnable notebook, checked keys).
2. Reviewed pilot metadata documents overlapping years, geography, and an explicit transform.

Matching column names (`iso_code`, `year`, `district`) are **not** enough. That result stays `review`.

## Current kits

| Kit | Status | Result grain | Rule |
|---|---|---|---|
| Energy use vs CO₂ | verified | country-year | Drop rows without ISO-3 (world/region totals). Join `iso_code` + `year`. Energy is TWh; `co2` is million tonnes. Notebook: [`data/energy-co2-example.ipynb`](../data/energy-co2-example.ipynb) |
| India crop + rainfall | verified | **subdivision**, not district | Map district → IMD subdivision, aggregate production, sum monthly rainfall to year, inner-join on subdivision + year. Unmatched districts are dropped. Crosswalk: [`data/india-district-subdivision.json`](../data/india-district-subdivision.json) |
| COVID-19 vs population | documented | country-year | Sum daily `new_cases` to calendar year, then join World Bank `SP.POP.TOTL` on ISO-3 + year. Population is a mid-year estimate. No checked notebook yet — treat as `review`, not `match`. |

## Do not

- Do not join on country **names** when ISO-3 exists.
- Do not keep aggregate rows (`World`, continent totals, rows with a blank ISO code).
- Do not join India crop to rainfall on **district name**.
- Do not treat the crop–rainfall result as district-level.
- Do not join a **daily** COVID row to **annual** population.
- Do not invent a file URL from a landing page.
- Do not treat an unspecified license as public domain.

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
