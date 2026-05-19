
## Goal

A new entry point on the community for customers to get an instant price quote by pasting a 3D model link, then publish it as a community print request that merchants can accept and message the customer to start preparing. The existing `/community` flow stays untouched.

## Scope (non‑breaking)

- Reuses existing tables `community_print_requests`, `print_offers`, `community_settings`, `community_messages`.
- Adds a new "quote_source" tag and a few estimation columns so quote-from-URL requests are distinguishable but flow through the same merchant pipeline.
- Adds one new admin page section, one new customer page, one new edge function, and a small "Quote from Link" entry card on `CommunityHome`.

## User Flow

1. On `/community`, a new card "احسب سعر طباعتك من رابط" → opens `/community/quote-from-link`.
2. Customer pastes URL (Thingiverse / Printables / MakerWorld / Cults).
3. Submit → edge function `print-quote-from-link`:
   - If cached for URL → return cached result.
   - Otherwise try metadata scrape (oEmbed / OG tags / Firecrawl-style fetch) for: title, thumbnail, filament weight (g), print time, dimensions, recommended printer.
   - If scrape misses any required field → Lovable AI Gateway estimates missing fields from title + scraped description + dimensions (category, complexity, weight, time).
   - Compute price using admin settings.
4. Result card shows: thumbnail, name, weight, time, difficulty, **price range (min–max ±15%)**, "Price transparency" expandable breakdown, source-link button, **Create Print Request** button.
5. Fallback: if URL parsing fails, show "Upload STL/3MF instead" → reuses existing custom-request file upload flow with the same quote endpoint (file size → weight heuristic).
6. Create Print Request → inserts row in `community_print_requests` with `quote_source='url_quote'`, prefilled title/notes/image, `estimated_price_min/max`, `reference_links=[url]`, `status='pending_review'`. Then redirects to existing tracking page.
7. The request appears on `/community/requests` browse like other requests, with a "عرض سعر فوري" badge. Merchants accept via existing `print_offers` flow (one bid each), and on accept the existing accept-offer dialog already opens a chat — we just preselect the quoted price.

## Pricing Formula

```
filament_cost   = weight_g / 1000 * filament_price_per_kg
machine_cost    = print_time_hours * hourly_machine_cost
complexity_fee  = base_complexity_fee * { easy:1, medium:1.5, hard:2.2 }
subtotal        = filament_cost + machine_cost + complexity_fee
platform_fee    = subtotal * platform_fee_pct
profit_margin   = subtotal * profit_margin_pct
final           = subtotal + platform_fee + profit_margin
price_min/max   = final * 0.9  /  final * 1.15  (rounded to 250 IQD)
```

All values from `community_settings` (key = `quote_pricing`). Existing IQD/250 rounding rule applies.

## Database (one migration)

- New `community_settings` row `quote_pricing` (jsonb):
  ```
  { filament_price_per_kg, hourly_machine_cost, base_complexity_fee,
    platform_fee_pct, profit_margin_pct, min_range_pct, max_range_pct }
  ```
- `community_print_requests` add columns (nullable, no breakage):
  - `quote_source text` (`'url_quote' | 'file_quote' | null`)
  - `quote_url text`
  - `estimated_weight_g numeric`
  - `estimated_print_minutes integer`
  - `difficulty text` (`'easy'|'medium'|'hard'`)
  - `estimated_price_min integer`
  - `estimated_price_max integer`
  - `quote_breakdown jsonb`
- New table `print_quote_cache` (`url text unique`, `payload jsonb`, `expires_at`) for the dedupe/caching rule in step 10.
- RLS: cache readable by authenticated, writable only by service role (edge function).

## Edge Function: `print-quote-from-link`

- Input: `{ url?: string, file_meta?: { name, size_bytes, dims_mm? } }`.
- Steps: validate URL host → lookup cache → fetch metadata (host-specific parsers; fallback to OG/JSON-LD) → run Lovable AI Gateway (`google/gemini-3-flash-preview`) for missing fields with a strict JSON schema → load `quote_pricing` settings → compute breakdown → write cache → return `{ source: 'scrape'|'ai'|'cached', model, breakdown, min, max }`.
- Auth: `verify_jwt = true` (logged-in customers only), CORS enabled.
- No secrets needed beyond `LOVABLE_API_KEY` (already provisioned).

## Frontend

- `src/pages/CommunityQuoteFromLink.tsx` — input, result card with skeletons, glass-panel layout, mobile-first.
- `src/components/community/QuoteResultCard.tsx` — preview, range, "Price transparency" collapsible, "Create Print Request" / "Upload file instead".
- `src/components/community/QuoteFromLinkEntry.tsx` — entry tile added to `CommunityHome.tsx` (no removal of existing cards).
- Route added in `src/App.tsx`: `/community/quote-from-link`.
- `CommunityRequestsBrowse` / `CompactRequestCard`: render "عرض سعر فوري" badge when `quote_source = 'url_quote'` and show price range chip. Accept flow uses existing `AcceptOfferDialog` / `AddOfferDialog` — merchant can submit a bid at or near the quoted range; accepting opens the existing community chat where merchant requests payment.
- All strings in `ar/en/ku` i18n files.

## Admin

- Extend existing `AdminCommunityComplaints`-style settings area (or `AdminDefaultSettings` "Community" tab) with a new "أسعار العرض الفوري" section editing the `quote_pricing` jsonb (filament/kg, hourly cost, complexity fee, platform fee %, margin %, min/max range %). Live preview of formula with sample inputs.

## Caching (step 10)

`print_quote_cache.url` unique; TTL 30 days. Edge function checks cache first; on hit returns immediately with `source: 'cached'`.

## Out of scope / explicitly preserved

- No change to existing merchant accept/escrow logic, existing `print_offers` rules (1 bid/merchant), chat, or commerce flow.
- No change to existing request creation form (`CommunityCustomerNewRequest`); the new flow is a parallel entry point that writes into the same table with extra metadata.

## Open questions before I build

1. Default values for `quote_pricing` (filament IQD/kg, hourly machine cost, complexity fee, platform %, margin %)?
2. Should the merchant bid be **locked** to the quoted range, or only **prefilled** and editable?
3. For the file fallback, do you want real slicing (heavy, needs a slicer service) or a size‑based heuristic + AI estimation only (recommended, fast)?
4. Confirm caching TTL = 30 days, and that re-quoting the same URL by a different user reuses the cached estimate.
