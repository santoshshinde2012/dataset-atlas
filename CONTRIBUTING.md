# Contributing

The Dataset Atlas is a static, Apache-2.0 catalog. Prefer a **verified join** over a larger catalog. Unknown coverage, license, schema, or joins stay unknown.

## Required checks

Run these after every change:

```sh
npm test
npm run validate
npm run build:site
```

Browser smoke tests (needs Playwright once): `npm ci && npx playwright install chromium && npm run test:e2e`.

CI on GitHub runs the same gates. Do not merge with a failing check.

## What to change

| You want to… | Change | Do not |
|---|---|---|
| Add or correct a dataset | `data/catalog.json`, then `npm run validate` | Guess country tags, files, or licenses |
| Add a starter “I want to…” bundle | `PRESETS` in `js/config.js` | Point a bundle at a URL that is not in the catalog |
| Add a join kit | `js/kits.js` plus tests, samples, and a notebook for `verified` | Label `match` from column names alone |
| Screen reuse or link health | `js/license-use.js` / `js/link-health.js` | Treat unspecified as public domain |
| Change MCP | `scripts/atlas-mcp.js` using existing pure modules | Duplicate sanitizer or fit logic |
| Change layout or map | `js/ui/` or `js/map/` | Import one UI module from another |

Module boundaries: [architecture and conventions](docs/architecture-and-conventions.md). Join rules: [join kits](docs/join-kits.md). Agent tools: [MCP](docs/mcp.md).

## Catalog rules

- Link the **dataset page**, not a portal homepage.
- A landing page is not a file. Add `resources[]` only for a checked download or API.
- `countries` are ISO 3166-1 alpha-2, at most four, and only when coverage is clear.
- `coverageKind: global-country-series` means a worldwide country-year series (World Bank, OWID). Focusing India can show it as a **candidate**, not a verified India extract.
- `freshnessYear` and `coverageEnd` are editorial. The refresh job must not rewrite them.
- Confirm license text at the source. Unspecified is not public domain.

## Join-kit rules

A kit is `verified` only with a runnable notebook and checked cardinality. A kit is `documented` when the transform is explicit but not yet checked. Matching key names are never enough for `match`.

Unmatched geography is **dropped**, never guessed. Result grain must be stated (country, subdivision, …).

## Pull requests

1. One concern per PR (catalog edit, kit, UI, docs).
2. Tests for any behavior users or MCP clients can see.
3. Short summary and the commands you ran.
4. No secrets, no `.env`, no paid backend.

This project has no runtime accounts. Do not add authentication or a database unless the product explicitly requires per-user data.
