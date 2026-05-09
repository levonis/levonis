## Problem

The Bambu Lab page [H2C Induction Hotend](https://us.store.bambulab.com/products/h2c-induction-hotend-standard-high-flow) has **two axes**:
- **Type** (2 values): `Standard Flow`, `High Flow` — each shown with a small product image
- **Size** (4 values): `0.2mm Stainless Steel`, `0.4mm`, `0.6mm`, `0.8mm Hardened Steel`

Our current parser in `supabase/functions/extract-product-info/index.ts` (`parseBambuLabUnified`, lines 880–951) walks every `<li value="...">` and classifies a variant as a **color** if it has an `<img>` swatch from `bblcdn`, otherwise as an **option** — regardless of which axis it belongs to. On the H2C page this produces a wrong mix: both axes get flattened into one bucket, and the relationship between them is lost.

The user wants:
- Axis with the **2 Type values** → extracted as **options** (`Standard Flow`, `High Flow`).
- Axis with the **4 Size values** → extracted as **colors** for the selected option.

## Approach

Make extraction **axis-aware** for Bambu Lab pages, then map axes onto our existing `colors[]` / `options[]` buckets according to a simple rule.

### 1. Detect axes from the RSC payload

Bambu's Next.js RSC payload encodes each variant axis with a `propertyKey` (e.g. `"Type"`, `"Size"`, `"Color"`) and a `propertyValue`. We already parse `propertyKey:"Color"` blocks in `buildBambuVariantImageMap` (line 841). Extend this:

- Build a `Map<propertyValue → propertyKey>` from **all** `propertyKey/propertyValue` pairs in the RSC payload (any key, not just `Color`).
- Group variants by `propertyKey` to know which axis each `<li value="...">` belongs to.

### 2. Axis-to-bucket mapping rule

After grouping, decide which axis becomes **options** and which becomes **colors**:

- If a real `Color` axis exists → keep current behavior (Color → colors, others → options). No regression for filament pages.
- Else if there are exactly two non-color axes:
  - The axis whose values look like sizes/nozzles/flow (`mm`, `Flow`, `kg`, `g`) and/or has the **larger** count → **colors**.
  - The other axis (smaller count, typically `Type`) → **options**.
  - Tie-breaker: prefer the axis whose values are present in the SKU image map (so colors get real product images).
- Else (single axis) → keep current image-vs-text heuristic.

For the H2C page this resolves to: `Type` (2) → options, `Size` (4) → colors.

### 3. Wire results into existing fields

- `options[]` entries keep `{ name, name_ar, image_url }` (the per-Type product photo from the RSC `mediaFile` map already exists).
- `colors[]` entries keep `{ name, name_ar, hex_code, image_url }`. Since sizes don't have a real swatch color, set `hex_code = null` and use the variant's product image (`variantImages.get(key)`) as `image_url`. Do **not** call `sampleSwatchColor` for non-color axes.
- Extend the Arabic translation map (`bambuOptionArMap`, line 616) with the new H2C terms: `standard flow`, `high flow`, `stainless steel`, `hardened steel` — so the extracted Arabic names read naturally.

### 4. Safety

- Pure addition inside `parseBambuLabUnified` + `buildBambuVariantImageMap`; no schema change, no new tables.
- Filament pages (single `Color` axis, or `Color` + `Spool`/`Weight`) hit the first branch and behave exactly as today — verified by the existing comment block at lines 566–574.
- If RSC parsing fails or no axis info is found, we fall back to the current `<li>` image heuristic (no regression).

## Technical Details

**File:** `supabase/functions/extract-product-info/index.ts`

1. **`buildBambuVariantImageMap`** (lines 784–878): also collect a `Map<normalizedValue → propertyKey>` and return it alongside the existing image map (change return type to `{ images: Map<…>, axes: Map<…> }`).
2. **`parseBambuLabUnified`** (lines 883–951):
   - After collecting all `<li value="...">` matches, group them by axis using the new map.
   - Apply the mapping rule from §2 to assign each axis to `colors[]` or `options[]`.
   - Skip swatch hex sampling for variants whose axis is not `Color`.
3. **`bambuOptionArMap`** (line 616): add `'standard flow' → 'تدفق قياسي'`, `'high flow' → 'تدفق عالي'`, plus `'stainless steel' → 'ستانلس ستيل'`, `'hardened steel' → 'فولاذ مقوّى'` (used as suffixes inside `translateBambuOption` / a small helper for size names).
4. No changes to DB, RLS, or edge function deployment config.

## Verification

- Re-run extraction on the H2C URL → expect `options = [Standard Flow, High Flow]` (each with its product image), `colors = [0.2mm Stainless Steel, 0.4mm Hardened Steel, 0.6mm Hardened Steel, 0.8mm Hardened Steel]` (each with the matching product image, `hex_code = null`).
- Re-run extraction on a normal filament page (e.g. PLA Basic) → unchanged: colors[] gets the color swatches with hex codes, options[] gets `Refill` / `With Spool` / weight, exactly as today.
