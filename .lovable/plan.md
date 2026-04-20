

## Fix Bambulab US Store Extraction (Colors & Options)

### Problem
For URLs like `https://us.store.bambulab.com/products/pla-silk-upgrade`:
- **Colors are wrong**: hex codes are AI-guessed (often inaccurate) and color names mix in unrelated values
- **Options are wrong / missing**: variant types like "Refill / Standard" and sizes like "1 kg" are either lumped into colors or skipped entirely

### Root Cause
The Bambulab US/EU stores are Next.js apps that ship product data as **React Server Components (RSC) streams** inside `<script>self.__next_f.push([1,"..."])</script>` chunks — not as standard `<li value="…">` swatches and not via the `/api/spu/product` endpoint (that endpoint only works on the China store and currently returns a 404 HTML page on the US store).

The existing `parseBambuLabColors` in `supabase/functions/extract-product-info/index.ts` only handles:
1. `<li value="ColorName" …><img …></li>` swatches (only present after client-side JS hydration)
2. A spec-table fallback that doesn't exist on the US store

So both pathways yield **0 colors** on the US store, the function falls back to the AI extractor, and the AI:
- guesses hex codes (wrong shades)
- conflates the `Type` and `Size` properties with `Color`
- misses the `colorUrl` swatch images embedded in the RSC payload

### Fix

**1. New RSC parser in `supabase/functions/extract-product-info/index.ts`**

Add `parseBambuLabRSC(html)` that:
- Concatenates all `self.__next_f.push([1,"…"])` payloads into a single string (unescaping `\"` and `\n`)
- Finds every chunk of shape `{"id":"…","value":"<Name>","…"colorUrl":"<url>"…}` → these are **Color values** with their official swatch image
- Finds every `{"propertyKey":"<Color|Type|Size|…>","propertyValue":"<value>","colorUrl":<url|null>…}` block to learn which property each value belongs to
- Returns `{ colors: [...], options: [...] }`:
  - **Colors** (propertyKey === "Color"): `{ name, name_ar, hex_code, image_url }`
    - `image_url` = the `colorUrl` PNG swatch (deterministic, exact)
    - `hex_code` = sample the swatch image server-side using a tiny canvas-free pixel read OR mark as `null` (preferred: leave the existing `parseBambuLabColors` table-hex pathway as a hint and otherwise default to `#808080` so the UI uses the swatch image, not the hex)
    - `name_ar` derived from the existing `bambuColorArMap` (keep SKU code in parentheses)
  - **Options** (propertyKey in `["Type","Size","Nozzle","Material","Spool","Variant",...]`): `{ name, name_ar, image_url: null }`, with translations for the common cases ("Refill"→"إعادة تعبئة", "Filament with spool"→"خيط مع بكرة", "1 kg"→"1 كغم", etc.)

**2. Wire it into the existing Bambulab override block (around line 1386)**

Replace the current call:

```text
parseBambuLabColors(html)
   │
   ▼
returns 0 → AI fallback runs
```

with:

```text
parseBambuLabRSC(html)               ← NEW (handles US/EU stores)
   │ if 0 colors
   ▼
parseBambuLabColors(html)            ← existing (handles China store + hydrated HTML)
   │ if still 0 colors
   ▼
Firecrawl rendered HTML → retry both parsers
```

When the new parser returns options too, **replace** `productInfo.options` with them (currently options also come from the AI and get duplicated/wrong).

**3. Keep behavior safe for non-Bambulab platforms**

The new parser is only invoked when `platform === 'bambulab'`. Other extractors are untouched.

### Files to Edit
- `supabase/functions/extract-product-info/index.ts` — add `parseBambuLabRSC()` (~80 lines) and update the override block (~15 lines changed)

### Verification (after deploy)
1. Test URL: `https://us.store.bambulab.com/products/pla-silk-upgrade` → expect 13 colors (Titan Gray, Rose Gold, Baby Blue, Champagne, Mint, …) each with the official `store.bblcdn.eu/...png` swatch image, plus options `Type: Refill / Standard` and `Size: 1 kg`.
2. Re-test an existing China-store Bambulab URL (e.g. `bambulab.tmall.com/...`) → should still extract via the legacy `parseBambuLabColors` path.

