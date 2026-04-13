

# Fix: Color Hex Codes and Images Being Overridden by Generic COLOR_MAP

## Problem

In `extract-product-info/index.ts` (lines 855-866), when the AI extracts a color like "Translucent Teal" with hex `#77EDD7`, the code searches COLOR_MAP for a partial match ("teal" found in "translucent teal") and **replaces** the AI's accurate hex with the generic `#008080`. Same issue with `name_ar` - the specific Arabic translation is overridden.

Additionally, color-specific images from the AI may be inaccurate since the source site is JS-rendered.

## Fix

### 1. Fix hex_code priority in `extract-product-info/index.ts` (lines 863-866)

Change the logic so AI-provided hex_code takes priority over COLOR_MAP when the AI gave a valid hex:

```ts
// Before (broken):
hex_code: info ? info[1].hex : c.hex_code || '#808080',
name_ar: info ? info[1].ar : c.name_ar || c.name,

// After (fixed):
hex_code: (c.hex_code && /^#[0-9A-Fa-f]{6}$/i.test(c.hex_code)) 
  ? c.hex_code 
  : (info ? info[1].hex : '#808080'),
name_ar: c.name_ar || (info ? info[1].ar : c.name),
```

This means: if AI gave a valid hex code, use it. Otherwise fall back to COLOR_MAP, then to `#808080`.

### 2. Improve AI prompt for hex accuracy (lines 718, 734-764)

Add explicit instruction in the prompt:
- "For each color, provide the EXACT hex code that represents the actual shade - not a generic color. Example: Translucent Teal should be #77EDD7, not generic #008080"
- "Include the color variant code/SKU number in the color name if shown on the page (e.g., 'Translucent Teal (32501)')"

### 3. Same fix in `retry-extract-colors/index.ts`

The retry function also needs the same prompt improvement to request exact hex codes and return them accurately (it already doesn't have COLOR_MAP override, but the prompt should be enhanced).

### 4. Enhance prompt for color-specific images

Add instruction: "For each color, the image_url MUST be the swatch image or product image showing THAT specific color variant - not the main product image."

## Files
- `supabase/functions/extract-product-info/index.ts` — fix hex priority + enhance prompt
- `supabase/functions/retry-extract-colors/index.ts` — enhance prompt for exact hex codes

