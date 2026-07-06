# Deploy — push to GitHub, then go live (all free)

## A. Push to GitHub

**One-time setup**

1. Create an empty repo at <https://github.com/new> — name it e.g. `asiantitstok`. Don't add a README (you already have files).
2. On your computer, in the folder that holds `index.html`, run:

```bash
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/asiantitstok.git
git push -u origin main
```

If it asks for a password, use a **Personal Access Token** (GitHub → Settings → Developer settings →
Tokens), not your account password.

**Every update after that**

```bash
git add .
git commit -m "Update videos"
git push
```

> Keep your X API token OUT of the repo. It only ever lives in the fetch-script env var or the
> Cloudflare Worker secret — never in a committed file.

---

## B. Put it online — free options

### ⭐ Option 1 — Cloudflare Pages (recommended)
Free, fast, custom domain, **and it applies your `_headers` security file** (GitHub Pages can't).

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick your repo. Build command: *none*. Output directory: `/` (root).
3. Deploy. You get `https://asiantitstok.pages.dev`. Add your own domain free under **Custom domains**.
4. Your `_headers` file is picked up automatically — hardening is live.

### Option 2 — GitHub Pages (simplest, but no custom headers)
1. Repo → **Settings → Pages** → Source: `main` / root → Save.
2. Live at `https://YOUR_USERNAME.github.io/asiantitstok/` in ~1 min.
3. ⚠️ GitHub Pages ignores `_headers`/`.htaccess`. To still get the security headers, put **Cloudflare
   (free plan)** in front of it as your DNS/proxy, or just use Option 1 instead.

### Option 3 — Netlify (also free, supports `_headers`)
1. <https://app.netlify.com> → **Add new site → Import from Git** → pick the repo.
2. Build command: *none*. Publish directory: `/`. Deploy.
3. `_headers` is applied automatically.

---

## C. Free pieces that power the site

| Piece | Free service | Notes |
|-------|-------------|-------|
| Hosting | Cloudflare Pages / GitHub Pages / Netlify | all free, custom domain free |
| Live view counter | Abacus (`abacus.jasoncameron.dev`) | free, no signup, already wired |
| Security headers | `_headers` (Pages/Netlify) or `.htaccess` (Apache) | free, included |
| X feed refresh | GitHub Actions (`x-fetch.js`) **or** Cloudflare Worker (`x-worker.js`) | both free tiers |
| X API access | — | **not free** (Basic ≈ $200/mo). Free alternative below. |

**Free X option (no API bill):** skip the token entirely and use X's official embedded timeline —
it auto-shows your latest posts with media and updates itself. Swap the custom carousel for:

```html
<a class="twitter-timeline" data-height="600" data-theme="dark"
   href="https://twitter.com/asiantitstok">Posts by @asiantitstok</a>
<script async src="https://platform.twitter.com/widgets.js"></script>
```
(Trade-off: X's styling instead of the custom gold cards, and it counts toward the CSP `frame-src`
entry that's already in your `_headers`.)

---

## D. Note on ad headers
The `Content-Security-Policy` allowlists Google AdSense, Analytics, YouTube, Google Fonts, Abacus,
and X. Ad networks change domains over time — if an ad unit or script ever gets blocked, open the
browser console, note the blocked domain, and add it to `script-src`/`frame-src`/`connect-src` in
`_headers` (and `.htaccess`). If you'd rather not tune it, delete the `Content-Security-Policy` line;
the other headers (framing, sniffing, referrer, HSTS) still harden the site on their own.
