# Deploying The Dataset Atlas for Free

The atlas is a pure static site — no build step, no server, no database, no environment variables. That means it deploys to every major free static-hosting tier at **$0/month, no credit card**, and comfortably within free-plan limits (the whole site is ~1.5 MB; free tiers start at 100 GB bandwidth/month).

| Option | Free tier | Best when | Custom domain | HTTPS |
|---|---|---|---|---|
| **GitHub Pages** (recommended) | 100 GB/mo bandwidth, 1 GB site | The repo already lives on GitHub | Free | Automatic |
| **Cloudflare Pages** | Unlimited bandwidth, 500 builds/mo | You expect real traffic | Free | Automatic |
| **Netlify** | 100 GB/mo, 300 build-min/mo | You want deploy previews per PR | Free | Automatic |
| **Vercel** | 100 GB/mo (hobby, non-commercial) | You already use Vercel | Free | Automatic |

All four serve the repo root as-is. Below, GitHub Pages is written out fully; the alternatives are condensed because they're near-identical.

---

## Option 1 — GitHub Pages (recommended)

The deploy workflow is **already in the repo** at `.github/workflows/deploy-pages.yml`. You only need to publish the repo and flip one setting.

### One-time setup (~3 minutes)

1. **Create the GitHub repository** (public repos get Pages free):

   ```bash
   cd ~/workspace/dataset-atlas
   gh repo create dataset-atlas --public --source=. --push
   # or without gh: create an empty repo on github.com, then
   # git remote add origin https://github.com/<you>/dataset-atlas.git
   # git push -u origin main
   ```

2. **Enable Pages via Actions**: on GitHub → your repo → **Settings → Pages → Build and deployment → Source: "GitHub Actions"**.

3. That's it. The push you just made (and every future push to `main`) triggers two workflows:
   - `CI` — syntax checks, the unit-test suite, catalog validation (a broken catalog never deploys),
   - `Deploy to GitHub Pages` — uploads the repo root and publishes it.

   There's also a third, scheduled workflow — `Refresh catalog` — that re-verifies every dataset link weekly and opens a PR when sources changed. For it to open PRs, enable **Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests"**.

   Your atlas is live at:

   ```
   https://<you>.github.io/dataset-atlas/
   ```

   (All asset paths in the app are relative, so serving from a sub-path works without configuration.)

### Updating the site

Just push to `main` — e.g. after editing the catalog:

```bash
npm run validate        # gate your catalog edit locally
git add data/catalog.json && git commit -m "catalog: add X" && git push
```

Live in ~30 seconds.

### Custom domain (optional, still free)

Settings → Pages → Custom domain → enter `atlas.yourdomain.com`, then add a DNS `CNAME` record pointing to `<you>.github.io`. GitHub provisions the TLS certificate automatically. (The domain itself is the only thing in this document that costs money — skip it and use the github.io URL.)

---

## Option 2 — Cloudflare Pages (unlimited bandwidth)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. Build settings: **Framework preset: None · Build command: *(leave empty)* · Build output directory: `/`**.
3. Deploy. Live at `https://dataset-atlas.pages.dev`, redeployed on every push to `main`.

Choose this if you expect heavy traffic — the free tier has no bandwidth cap.

## Option 3 — Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → pick the repo.
2. **Build command: *(empty)* · Publish directory: `.`** → Deploy.
3. Live at `https://<name>.netlify.app`, with free deploy previews for every pull request.

No-Git alternative: `npx netlify-cli deploy --dir=. --prod` or drag-and-drop the folder on the dashboard.

## Option 4 — Vercel

1. [vercel.com/new](https://vercel.com/new) → import the repo.
2. **Framework preset: Other · Build command: *(empty)* · Output directory: `.`** → Deploy.
3. Live at `https://dataset-atlas.vercel.app`. (Hobby tier is for non-commercial use.)

---

## Verifying a deployment

Whichever host you pick, run this checklist against the live URL once:

1. The globe renders and auto-rotates; countries are tinted (data + vendor files loaded — if you see the "serve over HTTP" fallback instead, the host isn't serving `data/*.json`, which never happens on the four hosts above).
2. Click a region → card rail opens with dataset cards; **Get data** opens the source in a new tab.
3. Pin two datasets → Passport → **Export manifest** downloads `data-passport.sh`.
4. Hard-refresh (Cmd/Ctrl+Shift+R) — pins persist (localStorage).
5. Open it on a phone — the filter rail starts collapsed, the map fills the screen.

## Notes

- **Caching**: all four hosts serve sensible cache headers and invalidate on deploy; no configuration needed. If you ever front the site with your own CDN, cache `vendor/*` and `data/world-110m.json` aggressively and give `data/catalog.json` a short TTL so catalog updates appear quickly.
- **Security headers** (optional hardening): on Cloudflare/Netlify you can add a `_headers` file with `Content-Security-Policy: default-src 'self'` — the app makes no cross-origin requests except the user clicking out to dataset sources. Note the boot watchdog in `index.html` is an inline script, so include `'unsafe-inline'` for `script-src` or move it to a file first.
- **Costs to actually expect**: $0. The only optional paid item anywhere in this setup is a custom domain (~$10/yr at a registrar).
