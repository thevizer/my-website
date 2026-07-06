/**
 * x-worker.js — Cloudflare Worker that securely serves the latest X posts
 * to the site. Your X bearer token stays server-side (never in the page).
 * Returns the SAME JSON shape as posts.json, with CORS + short caching so
 * X rate limits are respected. This is the "live, no rebuild" option.
 *
 * Deploy (https://developers.cloudflare.com/workers/):
 *   1. npm create cloudflare@latest xfeed   (choose "Hello World" Worker)
 *   2. Replace src/index.js with this file.
 *   3. npx wrangler secret put X_BEARER_TOKEN     (paste your token)
 *   4. (optional) set vars X_HANDLE / CACHE_SECONDS in wrangler.toml
 *   5. npx wrangler deploy
 *   6. In the page's SITE_CONFIG set:
 *        xFeedUrl: 'https://xfeed.YOURNAME.workers.dev'
 */
export default {
  async fetch(request, env, ctx) {
    const HANDLE = (env.X_HANDLE || 'asiantitstok').replace(/^@/, '');
    const TTL = parseInt(env.CACHE_SECONDS || '300', 10);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=' + TTL
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // Edge cache — keeps us well under X's rate limits
    const cache = caches.default;
    const cacheKey = new Request(new URL(request.url).origin + '/xfeed/' + HANDLE, request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    if (!env.X_BEARER_TOKEN) {
      return new Response(JSON.stringify({ error: 'missing X_BEARER_TOKEN' }), { status: 500, headers: cors });
    }
    const H = { Authorization: 'Bearer ' + env.X_BEARER_TOKEN };

    try {
      const uR = await fetch('https://api.twitter.com/2/users/by/username/' + HANDLE, { headers: H });
      const u = await uR.json();
      const uid = u.data && u.data.id;
      if (!uid) throw new Error('user not found');

      const params = new URLSearchParams({
        max_results: '20',
        exclude: 'retweets,replies',
        'tweet.fields': 'created_at,public_metrics',
        expansions: 'attachments.media_keys',
        'media.fields': 'type,url,preview_image_url,alt_text'
      });
      const tR = await fetch('https://api.twitter.com/2/users/' + uid + '/tweets?' + params, { headers: H });
      const t = await tR.json();

      const media = {};
      (((t.includes && t.includes.media) || [])).forEach(m => media[m.media_key] = m);

      const posts = [];
      ((t.data) || []).forEach(tw => {
        const keys = (tw.attachments && tw.attachments.media_keys) || [];
        const m = keys.map(k => media[k]).find(Boolean);
        if (!m) return;
        const img = m.url || m.preview_image_url;
        if (!img) return;
        posts.push({
          id: tw.id,
          url: 'https://x.com/' + HANDLE + '/status/' + tw.id,
          text: (tw.text || '').replace(/https?:\/\/\S+\s*$/g, '').trim(),
          media: img,
          poster: m.preview_image_url || img,
          type: m.type,
          date: tw.created_at,
          likes: (tw.public_metrics && tw.public_metrics.like_count) || 0
        });
      });

      const body = JSON.stringify({ handle: HANDLE, updated: new Date().toISOString(), count: posts.length, posts });
      const res = new Response(body, { headers: cors });
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e && e.message || e) }), { status: 502, headers: cors });
    }
  }
};
