

## التغيير المطلوب

النص بجانب المنتج المميز حالياً يعرض **اسم ووصف القسم الفرعي** (`category.name_ar` و `category.description_ar`). المطلوب تغييره ليعرض **اسم ووصف المنتج** نفسه.

## التعديل — `src/pages/CategoryDetail.tsx`

في السطور 98-105، استبدال:
- `category.name_ar` → `featuredProduct.name_ar`
- `category.description_ar` → `featuredProduct.description_ar`

```tsx
// قبل
<h1 ...>{category.name_ar}</h1>
{category.description_ar && <p ...>{category.description_ar}</p>}

// بعد
<h1 ...>{featuredProduct.name_ar}</h1>
{featuredProduct.description_ar && <p ...>{featuredProduct.description_ar}</p>}
```

ملف واحد فقط يتأثر، تغيير بسيط في سطرين.

