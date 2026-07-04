# OG Server-Rendered — Cloudflare Worker

Injects real `<head>` metadata (title, description, og:*, twitter:*) for
social/search crawlers on `levonisiq.com` product/STL/store pages, while
letting normal users hit the SPA unchanged.

## How it works

```
┌───────────┐    bot?    ┌──────────────────┐   /product/foo   ┌──────────┐
│ Cloudflare│──────yes──▶│ og-worker.js     │──── fetch ───────▶│  Origin  │
│  Worker   │            │  HTMLRewriter    │◀───  HTML  ───────│  (SPA)   │
│           │            │                  │                   └──────────┘
│           │            │  fetch head from │
│           │            │  product-og edge │
│           │            │  function        │
│           │            └────────┬─────────┘
│           │◀──── injected HTML ─┘
│           │
│           │──────no───▶ pass-through to origin (real user)
└───────────┘
```

- **Real users**: request is passed through unchanged → SPA loads.
- **Crawlers** (Facebook, Twitter/X, LinkedIn, Slack, Discord, Telegram,
  WhatsApp, Google, Bing, ...): worker fetches the SPA HTML, strips the
  default `<title>`, `<meta name="description">`, `og:*`, `twitter:*` and
  `canonical`, then prepends server-rendered head from the
  `product-og` Supabase Edge Function.

Add `?_og_debug=1` to any product URL to force the injection path (useful
for testing without spoofing user-agents).

## Setup

1. Install wrangler + login:
   ```bash
   npm i -g wrangler
   wrangler login
   ```
2. Edit `cloudflare/wrangler.toml`:
   - `SUPABASE_PROJECT_REF` — your Cloud project ref (subdomain of `*.supabase.co`).
   - `ORIGIN` — the Lovable published URL (default: `https://levonis.lovable.app`).
3. Deploy:
   ```bash
   cd cloudflare
   wrangler deploy
   ```
4. In the Cloudflare dashboard for `levonisiq.com`, add Worker Routes
   (or uncomment the `[[routes]]` blocks in `wrangler.toml` and redeploy):
   - `levonisiq.com/product/*` → `levonis-og`
   - `levonisiq.com/stl/*` → `levonis-og`
   - `levonisiq.com/s/*` → `levonis-og`

## Verify

```bash
# Real user (pass-through)
curl -sI https://levonisiq.com/product/some-slug

# Crawler simulation (should show x-og-injected: 1)
curl -sI -A "facebookexternalhit/1.1" https://levonisiq.com/product/some-slug

# Full head dump
curl -sA "facebookexternalhit/1.1" https://levonisiq.com/product/some-slug | grep -iE '<title|og:|twitter:'
```

Then re-check the URL in the
[Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/),
[Twitter/X Card Validator](https://cards-dev.twitter.com/validator),
or [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/).

## Adding a new route type

1. In `supabase/functions/product-og/index.ts`, extend the `type` switch
   with the new entity (returns `Meta { title, description, image, url, type }`).
2. In `cloudflare/og-worker.js`, add a `URL_MAP` entry mapping the URL
   pattern to `{ type, key }`.
3. Add the Cloudflare route (`levonisiq.com/<prefix>/*`) → `levonis-og`.
