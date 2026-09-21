---
name: dataset-atlas-join
description: Use the Dataset Atlas when joining public datasets. Call recommend_kit first. Empty list or do-not-join means do not write join code. Covers ISO aggregates, units, fiscal vs calendar year, India LGD/IMD, Nigeria P-codes, OpenAQ, and CHIRPS.
---

# Dataset Atlas join skill

You are joining public datasets. The atlas is a **join referee**, not a warehouse.

## Required flow

1. `recommend_kit` with the user's question.
2. If the list is **empty**: do not invent a join. Say so.
3. If `outcome` is **do-not-join**: refuse. Quote `doNot`.
4. `check_identifiers` on every country code. Drop `WLD`, `EUU`, `SAS`, `OWID_WRL`.
5. `check_units` and `check_vintage`. Conflict means do not treat columns as the same quantity or the same year.
6. `get_crosswalk` instead of joining on place names (IMD, LGD, P-code).
7. `get_resource` before telling the user they can download a file.
8. `assess_join` on two catalog ids. `match` only with a verified join kit.
9. `build_passport` for the source inventory.

Run the server from this repo:

```sh
node scripts/atlas-mcp.js
```

Or use the checked-in `.mcp.json`.

## Hard rules

- Landing pages are not files. Kaggle stays page + CLI.
- Unspecified licenses are not public domain and not AI-training-OK.
- TWh is not million tonnes. Current US$ is not PPP.
- Australia WDI "2022" GDP is FY 2021–22.
- World Bank population is mid-year; do not mix it with OWID population in the same per-capita.
- Census 2011 codes are not LGD.
- CHIRPS grid cells are not IMD subdivisions.
- OpenAQ stations are not a city or national AQI.
- Unmatched geography is dropped, never guessed.

A `match` is screening evidence, not a statistical guarantee.
