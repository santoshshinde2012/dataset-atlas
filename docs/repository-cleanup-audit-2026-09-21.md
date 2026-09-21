# Repository cleanup audit

21 September 2026 · baseline: `06eb115` · scope: tracked files, local references, browser dependency graph, build package, developer tooling, tests, and Pages workflow.

## Method

1. Enumerated all 84 tracked files with `git ls-files` and mapped each to a runtime, maintenance, test, documentation, or developer-tool entry point.
2. Compared the 32 browser JavaScript files in the explicit build list against static imports reachable from `js/main.js`. All 32 were reachable; no published browser module was orphaned.
3. Checked local Markdown links, dynamic browser journeys, build output, and the GitHub Pages workflow. The new repository tests keep module reachability and local links under CI.
4. Reviewed older documents against the current catalog, code, and prior product audit. Searched the icon registry and its runtime call sites.

## Cleanup decisions

| File or group | Decision | Evidence |
|---|---|---|
| `docs/system-design.md` | Delete | Duplicated the current architecture guide and still described 155 entries, older state, and a proposed design as the implementation. |
| `docs/dataset-atlas-concept-and-research.md` | Delete | Initial concept document contained old product claims and proposed features mixed with implemented behavior. Its useful current rules live in the architecture guide and README. |
| `js/icons.js` `map` icon and `ICON_NAMES` export | Remove | The icon had no caller and duplicated the atlas mark; the exported name list had no importer. |
| `.claude/skills/expedition/SKILL.md` | Keep and correct | It is a developer-facing workflow, but overstated verification, commercial license clearance, and MCP file creation. |
| `docs/research-audit-2026-09-20.md` | Keep as a dated snapshot | It records evidence and unresolved product gaps. A status note now identifies findings already fixed by PR #38. |
| `vendor/` scripts and licenses | Keep | Map rendering loads the pinned scripts; the license notices must accompany distributed copies. |
| `data/` files | Keep | The runtime loads catalog, pilot and geography files; the workbench serves the notebook. These URLs are part of the published site. |
| `.claude/launch.json`, `.mcp.json`, workflows, tests | Keep | They are explicit preview, MCP, CI, refresh, deployment, and regression entry points. Their absence would remove supported maintenance paths. |

The workflow checkout and Node setup actions were moved from v4 to the maintained v6 line, following the upstream [checkout releases](https://github.com/actions/checkout/releases) and [setup-node releases](https://github.com/actions/setup-node/releases). The Pages upload/deploy actions remain at their documented compatible versions; changing the artifact contract during a file cleanup has no demonstrated benefit.

The `dist/` directory remains generated and ignored. The Pages workflow uploads only the `dist/` artifact. GitHub's [custom Pages workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) supports that packaging boundary. Browser modules use explicit relative imports, consistent with [MDN's module guidance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules). Those facts are why an apparently unused source file cannot be judged by filename or build inclusion alone.

## Verification and limits

The repository tests enforce complete static import reachability for published JavaScript and valid local maintainer-documentation links. They do not prove that every CSS rule is used in every browser state, or that a curated dataset remains accurate at its provider. Browser smoke tests cover the map, search, passport, workbench, mobile keyboard flow, and deploy package. Catalog validation checks 171 entries. Review dated provider metadata separately through the scheduled refresh and editorial process.

Further product work is listed in the [dated product audit](research-audit-2026-09-20.md). Those gaps need source verification and user-facing design; they are separate from deleting stale repository files.
