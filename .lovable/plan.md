
User wants the featured product to also appear in the regular products grid below (not just in the hero section).

In `src/pages/CategoryDetail.tsx`, currently:
```ts
const otherProducts = products?.filter(p => p.id !== featuredProduct?.id) || [];
```
This excludes the featured product from the grid.

## Change
In `src/pages/CategoryDetail.tsx`, replace `otherProducts` with the full `products` list so the featured product appears both in the hero and in the grid below.

```ts
const otherProducts = products || [];
```

That's the only change needed. The hero section keeps showing the featured product on top, and the grid below now includes all products including the featured one.
