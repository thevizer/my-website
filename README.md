# Asian TitsTok — upgraded site

Everything is in this folder:

| File | What it is |
|------|-----------|
| `index.html` | The upgraded site. Ships working immediately (uses `posts.json` + a live counter). |
| `posts.json` | The X feed the page reads. **Sample data** — gets overwritten by the fetch script. |
| `x-fetch.js` | Node script: pulls latest posts+media from X → writes `posts.json`. Run on a schedule. |
| `x-worker.js` | Cloudflare Worker: the "live, no rebuild" alternative. Serves the feed straight from X. |

Just want it live now? Upload `index.html` + `posts.json` to your host. Everything works — the
gallery shows the sample posts and the view counter is already counting real visits. The two
`.js` files are only needed when you want the gallery to auto-pull from your real X account.

---

## 1. The honest bit about "auto media from X"

A single HTML file **cannot** pull an account's posts by itself. Two hard reasons:

- **The token can't be in the page.** Reading tweets needs an X API bearer token. Anything in
  `index.html` is visible to every visitor — publishing your token there means anyone can steal it.
- **X blocks direct browser calls** (CORS). The request has to come from a server, not the page.

So the working pattern is: **something server-side holds the token and produces a `posts.json`;
the page just reads that file.** You have two ways to do that (pick one):

### Option A — Scheduled script (simplest, free hosting-friendly) ✅ recommended
`x-fetch.js` runs every N minutes somewhere, refreshes `posts.json`, done. The page reads the file.

### Option B — Cloudflare Worker (live, nothing to rebuild)
`x-worker.js` sits between the page and X, caches for ~5 min, and returns the feed on demand.
Point `xFeedUrl` at the worker URL instead of `posts.json`.

> ⚠️ **X API costs money now.** Reading a user timeline is **not** on the free tier. As of 2026 you
> need at least the **Basic** plan (~US$200/month) from <https://developer.x.com>. The **Free** tier
> is essentially post-only and won't return timelines. If you don't want to pay, use the
> **zero-cost fallback** at the bottom of this file (official X embed).

---

## 2. Get your X API token

1. Go to <https://developer.x.com> → apply for a developer account → create a **Project + App**.
2. Choose a plan that allows **read** (Basic or higher).
3. Copy the **Bearer Token** from the app's *Keys and tokens* screen. Keep it secret.

---

## 3A. Run the fetch script (Option A)

Needs Node 18+.

```bash
X_BEARER_TOKEN="PASTE_YOUR_TOKEN"  X_HANDLE="asiantitstok"  node x-fetch.js
```

That writes a fresh `posts.json`. To keep it fresh automatically, schedule it.

**Linux cron — every 15 min:**
```
*/15 * * * *  cd /path/to/site && X_BEARER_TOKEN=xxxx node x-fetch.js && <upload posts.json>
```

**GitHub Actions** (commits the refreshed feed back to the repo — great if you host on GitHub
Pages / Netlify / Vercel). Add `.github/workflows/x-feed.yml`:
```yaml
name: Refresh X feed
on:
  schedule: [{ cron: "*/30 * * * *" }]   # every 30 min
  workflow_dispatch:
jobs:
  fetch:
    runs-on: ubuntu-latest
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node x-fetch.js
        env:
          X_BEARER_TOKEN: ${{ secrets.X_BEARER_TOKEN }}
          X_HANDLE: asiantitstok
      - run: |
          git config user.name  "feed-bot"
          git config user.email "feed-bot@users.noreply.github.com"
          git add posts.json
          git commit -m "chore: refresh X feed" || echo "no changes"
          git push
```
Add your token under the repo's **Settings → Secrets → Actions → `X_BEARER_TOKEN`**.

## 3B. Deploy the Worker (Option B)

```bash
npm create cloudflare@latest xfeed        # pick "Hello World" Worker
# replace src/index.js with x-worker.js
npx wrangler secret put X_BEARER_TOKEN     # paste your token
npx wrangler deploy
```
Then edit the `SITE_CONFIG` block near the top of `index.html`:
```js
xFeedUrl: 'https://xfeed.YOURNAME.workers.dev',
```

---

## 4. Configure the page

Everything tweakable lives in one block at the top of `index.html` — no code-diving:

```js
window.SITE_CONFIG = {
  xHandle: 'asiantitstok',
  xFeedUrl: 'posts.json',        // or your Worker URL
  xFeedRefreshMs: 5 * 60 * 1000, // page re-pulls the feed every 5 min
  counterNamespace: 'asiantitstok.com',
  counterKey: 'views',
  counterPollMs: 20 * 1000,      // live view number refreshes every 20s
  hideEmptyVideos: true
};
```

**Feed format** (what the page expects). Each post:
```json
{ "id":"123", "url":"https://x.com/asiantitstok/status/123",
  "text":"caption", "media":"https://pbs.twimg.com/media/....jpg",
  "poster":"https://...jpg", "type":"photo", "date":"2026-07-05T10:00:00Z", "likes":142 }
```
`type` is `photo`, `video`, or `animated_gif`. Photos open in the lightbox; videos open the tweet on X.

---

## 5. The live view counter

Now powered by **Abacus** (`abacus.jasoncameron.dev`) — free, no signup, no key, CORS-enabled.
It counts one hit per browser session, then polls every 20s so the number ticks up **live** as
other people visit (with a little green pulse). If Abacus is ever unreachable it falls back to your
original **hits.sh** counter automatically. Keep `counterNamespace` stable and the total keeps
accumulating; change it and you start from zero.

---

## 6. What else got improved

- **X gallery** is now data-driven (one feed → cards) instead of 12 hard-coded duplicates.
- **SEO/social:** description, canonical, Open Graph + Twitter Card, and an inline favicon.
- **Accessibility:** skip-to-content link, keyboard-operable gallery (Tab + Enter), visible focus rings, honors *reduce-motion*.
- **Performance/CLS:** banner gets width/height + `fetchpriority=high`; feed images lazy-load and decode async.
- **Cleaner grid:** unfinished `about:blank` video slots are dropped automatically.
- **Lightbox:** rebuilt to work after the feed refreshes, with a "View on X" link.

---

## Zero-cost fallback (no API, no token, no script)

If you don't want to pay for the X API, drop X's **official embedded timeline** in place of the
custom carousel. It auto-shows your latest posts (media included) and updates on its own — the
trade-off is X's styling instead of the custom gold cards:

```html
<a class="twitter-timeline" data-height="600" data-theme="dark"
   href="https://twitter.com/asiantitstok">Posts by @asiantitstok</a>
<script async src="https://platform.twitter.com/widgets.js"></script>
```
