

# إصلاح مشكلة "نفذ من المخزون" الخاطئة في صفحة البندلات

## السبب
في `ProductBundles.tsx`، عند فحص المخزون لعنصر بندل بدون `selected_option_id`، الكود يعمل fallback إلى `colorEntry.stock ?? product.direct_stock ?? 0`. لكن الألوان تستخدم `option_stocks` (مثل `{"تعبئة بدون روله": 7}`) وليس `stock`. فيرجع 0 دائماً ويعتبر المنتج نافذ.

مثال: لون Yellow فيه `option_stocks: {"تعبئة بدون روله": 7}` لكن الكود يتجاهلها لأن `selected_option_id` فارغ.

## الإصلاح

### `src/pages/ProductBundles.tsx`
تعديل منطق حساب المخزون (حوالي سطر 40-45):

عندما `selected_option_id` فارغ **و** اللون يملك `option_stocks` → جمع كل قيم `option_stocks` كمخزون متاح بدلاً من الرجوع لـ `colorEntry.stock`.

```typescript
// Before:
const stock = item.selected_option_id 
  ? (optStocks[item.selected_option_id] ?? 0) 
  : (colorEntry.stock ?? product.direct_stock ?? 0);

// After:
let stock = 0;
if (item.selected_option_id) {
  stock = optStocks[item.selected_option_id] ?? 0;
} else if (Object.keys(optStocks).length > 0) {
  stock = Object.values(optStocks).reduce((sum, v) => sum + Number(v), 0);
} else {
  stock = colorEntry.stock ?? product.direct_stock ?? 0;
}
```

ملف واحد فقط يحتاج تعديل.

