

# Fix: Bambu Lab Color Names, Hex Codes, and Images Accuracy

## Root Cause

1. **Colors found but inaccurate**: The AI finds 8-12 colors from its training data (the product name "PETG Translucent" is enough), but the hex codes and images are **hallucinated** because the server-rendered HTML has NO color/variant data
2. **Firecrawl never triggers**: The fallback only runs when `colors.length === 0`, but the AI already guessed colors, so Firecrawl is skipped
3. **Firecrawl fallback has old bug**: Even if it ran, lines 1221-1224 still have the broken COLOR_MAP-priority logic (not fixed in the last update)
4. **Missing SKU codes in names**: The color name "Translucent Orange" should be "Translucent Orange (32300)" as shown on the actual site

## Fix

### In `extract-product-info/index.ts`:

**Change 1**: For JS-rendered sites (like Bambu Lab), **always** use Firecrawl when available, regardless of whether the AI already guessed colors. Change condition from `if (productInfo.colors.length === 0)` to also trigger when the site is JS-rendered AND the Bambu Lab API failed:

```ts
const shouldTryFirecrawl = productInfo.colors.length === 0 || 
  (isJsRendered && !platformApiData && firecrawlKey);
```

When Firecrawl returns better data (colors with valid image_urls from the actual site), **replace** the AI-guessed colors.

**Change 2**: Fix the Firecrawl fallback color processing (lines 1221-1224) to match the fixed main logic:

```ts
hex_code: (c.hex_code && /^#[0-9A-Fa-f]{6}$/i.test(c.hex_code)) 
  ? c.hex_code 
  : (info ? info[1].hex : '#808080'),
name_ar: c.name_ar || (info ? info[1].ar : c.name),
```

**Change 3**: Enhance the Firecrawl color extraction prompt (lines 1167-1185) to include the same accuracy instructions:
- Request exact hex codes from swatches, not generic approximations
- Include SKU/variant codes in names (e.g., "Translucent Orange (32300)")
- Extract the variant-specific product image URL (the image that shows when you click that color swatch)
- Look for `background-color` CSS properties on swatch elements to get exact hex codes

**Change 4**: Add better error logging for the Bambu Lab API call to understand why it's silently failing.

### In `retry-extract-colors/index.ts`:

Same Firecrawl prompt enhancement for consistency.

## Files
- `supabase/functions/extract-product-info/index.ts` — Firecrawl trigger condition, fix color priority bug, enhance prompt
- `supabase/functions/retry-extract-colors/index.ts` — prompt enhancement

