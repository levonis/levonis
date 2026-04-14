

# Fix: extractSkuData Missing Return Statement

## Root Cause

The function `extractSkuData` in `supabase/functions/extract-product-info/index.ts` (line 324-452) **does not have a return statement**. It builds `colors` and `options` arrays, logs them at line 451, but never returns them. So `directSkuData` on line 798 is `undefined`, and line 800's `directSkuData.colors.length` crashes with `Cannot read properties of undefined (reading 'colors')`.

This explains:
- Why EVERY Bambu Lab extraction attempt fails with the same error
- Why the error is at compiled line 1423 (mapping to source line 800)
- Why the log shows `Direct SKU extraction: 0 colors, 0 options` (from inside the function at line 451) but never shows line 800's log

## Fix

Add `return { colors, options };` at the end of the `extractSkuData` function, before the closing `}` at line 452.

```ts
// Line 451-452, change from:
  console.log(`Direct SKU extraction: ${colors.length} colors, ${options.length} options`);
}

// To:
  console.log(`Direct SKU extraction: ${colors.length} colors, ${options.length} options`);
  return { colors, options };
}
```

## File
- `supabase/functions/extract-product-info/index.ts` — add missing `return` statement in `extractSkuData` (line 452)

After this one-line fix, the edge function needs to be redeployed.

