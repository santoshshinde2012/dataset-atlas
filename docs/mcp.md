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

1. `search_catalog` or `list_kits` — find reviewed sources or a known pair.
2. `get_resource` — is there a file or API, or only a landing page? What does reuse screening say?
3. `assess_fit` — for a workbench task (`crop`, `health`, `energy`), do the sources overlap? Is there a kit?
4. `get_dataset` — full metadata and DNA notes when you need them.
5. `build_passport` — source inventory, Kaggle CLI where it exists, BibTeX, share link.

`list_bundles` is the curated “I want to…” starter sets. Those are discovery aids, not verified joins.

## Tools

| Tool | Helps you… | Will not |
|---|---|---|
| `search_catalog` | Facet and rank the curated catalog (query, domain, region, country ISO-2) | Search the live web or unreviewed portals |
| `get_dataset` | Read one entry, DNA notes, share URL | Fabricate a download |
| `get_resource` | Separate landing page vs file/API; license-use; link health | Invent a missing file |
| `list_bundles` | Pin a 5-dataset starter set | Claim those five join |
| `list_kits` | See verified and documented join kits | Upgrade `documented` to `verified` |
| `assess_fit` | Screen workbench sources for crop / health / energy | Return `match` from key names alone |
| `build_passport` | Export manifest + bibliography + share link | Download non-Kaggle files for you |

## Rules the server already enforces

- Every catalog row goes through [`js/catalog.js`](../js/catalog.js). Unsafe URLs never reach a tool result.
- Fit and join reuse [`js/fit.js`](../js/fit.js) and [`js/kits.js`](../js/kits.js). Browser and MCP answers stay aligned.
- Landing pages are not files. Kaggle stays **page + CLI**.
- `assess_fit` `match` requires documented overlap or a **verified** kit. The COVID kit is **documented** (daily → year) until a notebook exists — agents must not treat it as checked.
- A match is screening, not proof of a valid statistical comparison. Confirm license, units, and codebook at the source.

## Client instructions (copy)

When wiring a custom agent, keep this contract:

> Search the atlas catalog. Prefer `list_kits` before writing join code. Call `get_resource` before telling the user they can download a file. If `assess_fit` is not `match`, do not join. Do not invent URLs. Unspecified licenses are not public domain.

Join semantics: [join kits](join-kits.md). Module rules: [architecture](architecture-and-conventions.md).
