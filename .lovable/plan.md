

# Fix: Color Extraction Inaccuracy for JS-Rendered Sites (e.g., Bambu Lab)

## Root Cause

The `extract-product-info` and `retry-extract-colors` edge functions use plain `fetch()` to get page HTML. For sites like Bambu Lab (React/Next.js), the color swatches are rendered by JavaScript and **do not exist in the server-rendered HTML**. The AI then receives HTML with zero color data and either guesses incorrectly or returns nothing.

## Solution: Multi-Strategy Extraction with Firecrawl Fallback

### Strategy 1: Enhance direct extraction for known platforms

For Bambu Lab specifically, the site uses a known internal API pattern. Add platform-specific API fetching before falling back to HTML parsing.

**In `extract-product-info/index.ts`:**
- For `bambulab` platform, try fetching from their internal product API endpoint (`/api/spu/product?handle=<slug>`) which returns structured JSON with all variants, colors, and options
- Parse the structured response directly instead of relying on AI to guess from HTML

### Strategy 2: Add Firecrawl as JS-rendering fallback

For any site where plain `fetch()` returns insufficient color data (0 colors extracted), use Firecrawl to get the fully JS-rendered page content.

**Changes to `extract-product-info/index.ts`:**
1. After the initial `fetch()` + AI extraction, check if colors array is empty
2. If empty AND `FIRECRAWL_API_KEY` env var exists, make a second attempt using Firecrawl's scrape API to get the JS-rendered HTML
3. Re-run AI extraction on the Firecrawl-rendered content
4. Same logic applies to `retry-extract-colors/index.ts`

### Strategy 3: Improve AI extraction prompt

When the HTML clearly shows a JS-rendered site (contains `__NEXT_DATA__`, `__next`, React root divs):
- Tell the AI to use its knowledge of the product URL to identify colors
- Include the page URL prominently so the AI model can use its training data about the product
- Add a specific instruction: "If no color data is found in HTML, use your knowledge of this product to list all available colors"

## Technical Changes

### File: `supabase/functions/extract-product-info/index.ts`

1. **Add Bambu Lab API fetcher** (~20 lines) — before the generic fetch, try `https://us.store.bambulab.com/api/spu/product?handle={slug}` for bambulab platform
2. **Add Firecrawl fallback** (~30 lines) — after AI extraction returns 0 colors, if `FIRECRAWL_API_KEY` is set, re-fetch with Firecrawl and retry
3. **Improve AI prompt** — add instruction to use URL context and product knowledge when HTML lacks color data
4. **Add `__NEXT_DATA__` parser** (~15 lines) — extract product data from Next.js embedded JSON if present

### File: `supabase/functions/retry-extract-colors/index.ts`

1. **Same Firecrawl fallback** — if initial HTML has no color hints, use Firecrawl
2. **Same AI prompt improvement** — tell AI to use product URL knowledge

## Impact
- Sites with JS-rendered color swatches (Bambu Lab, modern Shopify, custom React stores) will get accurate color extraction
- No breaking changes for sites that already work (Chinese e-commerce with server-rendered HTML)
- Firecrawl is optional — works with or without it, just better with it

