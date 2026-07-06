#!/usr/bin/env node
/**
 * x-fetch.js — pull the latest posts (with media) from an X account and
 * write posts.json for the site to read. Run it on a schedule (cron /
 * GitHub Action) so the gallery stays fresh automatically.
 *
 * Requires : Node 18+ (built-in fetch)
 * Env vars :
 *   X_BEARER_TOKEN   (required)  X API v2 App Bearer token
 *   X_HANDLE         (optional)  username without @   [default: asiantitstok]
 *   X_MAX            (optional)  how many posts 5-100 [default: 20]
 *   OUT              (optional)  output path          [default: ./posts.json]
 *
 * Run once:  X_BEARER_TOKEN=xxxxx node x-fetch.js
 */
'use strict';
const fs = require('fs');

const TOKEN  = process.env.X_BEARER_TOKEN;
const HANDLE = (process.env.X_HANDLE || 'asiantitstok').replace(/^@/, '');
const MAX    = Math.min(Math.max(parseInt(process.env.X_MAX || '20', 10), 5), 100);
const OUT    = process.env.OUT || 'posts.json';

if (!TOKEN) { console.error('ERROR: set X_BEARER_TOKEN'); process.exit(1); }
const HEADERS = { Authorization: 'Bearer ' + TOKEN };

async function api(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (r.status === 429) {
    const reset = r.headers.get('x-rate-limit-reset');
    throw new Error('Rate limited by X. Retry after ' +
      (reset ? new Date(reset * 1000).toISOString() : 'a while') + '.');
  }
  if (!r.ok) throw new Error('X API ' + r.status + ': ' + (await r.text()));
  return r.json();
}

(async () => {
  // 1) resolve @handle -> numeric user id
  const u = await api('https://api.twitter.com/2/users/by/username/' + encodeURIComponent(HANDLE));
  const uid = u.data && u.data.id;
  if (!uid) throw new Error('User not found: @' + HANDLE);

  // 2) fetch recent posts + attached media
  const params = new URLSearchParams({
    max_results: String(MAX),
    exclude: 'retweets,replies',
    'tweet.fields': 'created_at,public_metrics',
    expansions: 'attachments.media_keys',
    'media.fields': 'type,url,preview_image_url,alt_text'
  });
  const t = await api('https://api.twitter.com/2/users/' + uid + '/tweets?' + params);

  const media = {};
  (((t.includes && t.includes.media) || [])).forEach(m => { media[m.media_key] = m; });

  const posts = [];
  ((t.data) || []).forEach(tw => {
    const keys = (tw.attachments && tw.attachments.media_keys) || [];
    const m = keys.map(k => media[k]).find(Boolean);
    if (!m) return;                                   // skip text-only posts
    const img = m.url || m.preview_image_url;         // videos expose only preview_image_url
    if (!img) return;
    posts.push({
      id:    tw.id,
      url:   'https://x.com/' + HANDLE + '/status/' + tw.id,
      text:  (tw.text || '').replace(/https?:\/\/\S+\s*$/g, '').trim(),
      media: img,
      poster: m.preview_image_url || img,
      type:  m.type,                                  // photo | video | animated_gif
      date:  tw.created_at,
      likes: (tw.public_metrics && tw.public_metrics.like_count) || 0
    });
  });

  const out = { handle: HANDLE, updated: new Date().toISOString(), count: posts.length, posts };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('Wrote ' + posts.length + ' posts -> ' + OUT);
})().catch(e => { console.error(String(e && e.message || e)); process.exit(1); });
