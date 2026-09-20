# Deploying The Dataset Atlas

The browser app is static and has no runtime package dependencies or backend. `npm run build:site` copies the browser assets into `dist/`; it does not compile or transform them. Publish **`dist/`**, not the repository root. The output includes the catalog, map data, application modules, styles, and vendored libraries. It excludes tests, maintenance scripts, MCP tooling, and repository documentation.

## GitHub Pages

The checked-in [deployment workflow](../.github/workflows/deploy-pages.yml) runs on pushes to `main` and manual dispatches. It calls the [CI workflow](../.github/workflows/ci.yml) first. Only after syntax, unit, catalog, and browser checks pass does it build `dist/` and upload that directory to GitHub Pages.

In repository **Settings → Pages**, set the build source to **GitHub Actions**. The site is published at `https://<owner>.github.io/<repository>/`. All app asset paths are relative, so the repository subpath works without a base-path setting.

The [daily catalog refresh](../.github/workflows/refresh.yml) commits checked metadata and requests the Pages workflow explicitly. A commit made with `GITHUB_TOKEN` does not trigger a normal push workflow. Dead links create or update one review issue; successful catalog checks can still be published.

## Other static hosts

Connect the repository to a static host such as Cloudflare Pages, Netlify, or Vercel with these settings:

| Setting | Value |
|---|---|
| Build command | `npm run build:site` |
| Output or publish directory | `dist` |
| Node.js version | 22 or newer |

For a manual deployment, run `npm run build:site` and upload the contents of `dist/`. Check each provider's current plan terms before choosing a host.

## Verify a release

1. Open the site and confirm the map renders without the boot error.
2. Select **Global** or a region and confirm dataset cards appear.
3. Search for a dataset, open a source link, and export a pinned Passport.
4. Load a shared URL in a new tab and confirm its filters and region restore.
5. Check the catalog date in the filter rail and verify `data/catalog.json` has the expected `generated` date.
6. Confirm a repository-only path such as `/README.md` returns 404 on the published site.

The browser smoke tests run against a locally served copy of the same `dist/` package before deployment.
