# MCP for people and agents

The atlas MCP server is the same catalog the map uses, exposed as tools. It has no backend, no API key, and no extra packages. It must not invent a download URL or a join.

Register with the checked-in [`.mcp.json`](../.mcp.json), or run:

```sh
node scripts/atlas-mcp.js
```

Compatible clients (Claude Code, Claude Desktop, any stdio MCP host) load the tools from that process.

## What it is for

People browse the map. Agents should use these tools instead of scraping Pages HTML or guessing joins from column names.

Typical flow:

1. `recommend_kit` — is there a verified pair (or a verified refusal) for this question?
2. If empty: `search_catalog` then `assess_join`. Do **not** write join code.
3. `check_identifiers` — drop aggregates.
4. `check_units` / `check_vintage` — same quantity? same year basis?
5. `get_crosswalk` — IMD, LGD, or P-code. Unmatched keys are dropped.
6. `get_resource` — file/API vs landing page; reuse screening; link health.
7. `assess_join` — `match` only with a verified join kit; `do-not-join` is conflict.
8. `build_passport` — source inventory, Kaggle CLI where it exists, BibTeX, share link.

`list_bundles` is the curated “I want to…” starter sets. Those are discovery aids, not verified joins.

## Tools

| Tool | Helps you… | Will not |
|---|---|---|
| `recommend_kit` | Pick a kit from a question (`query`, optional `task`) | Invent a join when the list is empty |
| `search_catalog` | Facet and rank the curated catalog | Search the live web or unreviewed portals |
| `get_dataset` | Read one entry, DNA notes, share URL | Fabricate a download |
| `get_resource` | Separate landing page vs file/API; license-use; link health | Invent a missing file |
| `list_bundles` | Pin a 5-dataset starter set | Claim those five join |
| `list_kits` | See verified kits and explicit refusals | Upgrade a refusal to a join |
| `assess_fit` | Screen workbench sources for a task | Return `match` from key names alone |
| `assess_join` | Screen two catalog **ids** | Guess `match` without a kit |
| `check_identifiers` | Classify ISO / World Bank / OWID codes; list `drop` vs `keep` | Treat `WLD` or `OWID_WRL` as a country |
| `check_units` | Same unit family? | Convert TWh to Mt or current US$ to PPP |
| `check_vintage` | Calendar vs fiscal vs mid-year vs census | Shift Australia FY into a calendar year |
| `get_crosswalk` | District → IMD or LGD; Nigeria `adm1_pcode` | Guess unmatched geography |
| `build_passport` | Export manifest + bibliography + share link | Download non-Kaggle files for you |

## How MCP keeps agents honest

- Every catalog row goes through [`js/catalog.js`](../js/catalog.js). Unsafe URLs never reach a tool result.
- Fit and join reuse [`js/fit.js`](../js/fit.js) and [`js/kits.js`](../js/kits.js). Browser and MCP answers stay aligned.
- `recommend_kit` empty → **stop**. Column names are not a kit.
- `assess_join` without a kit stays `review` or `conflict` — never a guessed `match`.
- OpenAQ vs national PM2.5, CHIRPS vs IMD, and WDI GDP (current US$) vs OWID CO₂ return **conflict**.
- Unmatched districts, LGD names, and unknown P-codes are **dropped**, never filled in.
- A [SKILL.md](../skills/join-kits/SKILL.md) repeats this contract for coding agents. [`server.json`](../server.json) is the registry card (GitHub stdio; no paid host).
- Landing pages are not files. Kaggle stays **page + CLI**.
- Unspecified licenses are not public domain.
- A match is screening, not proof of a valid statistical comparison.

## Client instructions (copy)

When wiring a custom agent, keep this contract:

> Call `recommend_kit` first. If it returns no kit, do not write join code. Call `get_resource` before telling the user they can download a file. Drop aggregates with `check_identifiers`. Call `check_units` and `check_vintage` before a ratio. Use `get_crosswalk` instead of joining on place names. If `assess_join` is not `match`, do not join. `do-not-join` is a refusal. Do not invent URLs. Unspecified licenses are not public domain.

Join semantics: [join kits](join-kits.md). Module rules: [architecture](architecture-and-conventions.md).
