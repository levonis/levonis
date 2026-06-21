## السبب الجذري

في `src/pages/Admin.tsx` السطر 444-520، الـ `useEffect` المسؤول عن تهيئة حقول المنتج (`productFeatures` / `productAIContent` / `productShortSummary` / `productSearchableAttrs` / `productColors` / `productCardDiscounts`) يعتمد على:

```ts
}, [productDialogOpen, editingProduct, defaultSettings]);
```

`defaultSettings` يأتي من React Query (السطر 411). عند الضغط على "استخراج":

1. `applyProductInfo` يستدعي `setProductFeatures([...])`, `setProductAIContent({...})`, `setProductShortSummary({...})`, `setProductSearchableAttrs([...])` ✓
2. لاحقاً يصل `defaultSettings` من الخادم (أو يتغيّر بعد invalidation) → الـ effect يُعاد تنفيذه → يدخل فرع `productDialogOpen && !editingProduct` (السطر 501) → **يصفّر كل هذه الحقول** ✗

نفس نمط مشكلة الأبعاد التي أصلحناها.

ملاحظة إضافية: `defaultSettings` غير مُستخدَم داخل جسم الـ effect نفسه — هو dep يتيم.

## الإصلاح

### `src/pages/Admin.tsx` — السطر 520

تغيير deps الـ effect من:
```ts
}, [productDialogOpen, editingProduct, defaultSettings]);
```
إلى:
```ts
}, [productDialogOpen, editingProduct]);
```

هذا يمنع إعادة التنفيذ عند وصول/تغيّر `defaultSettings`، فلن تُمسح الحقول المُستخرَجة. التهيئة الأولى تحدث عند فتح الـ dialog وعند تغيّر المنتج فقط، وهو السلوك المطلوب.

### لا تغييرات في:
- مكان آخر في الكود (الـ defaults المستخدمة من `defaultSettings` في `handleAddOption`/`handleAddColor` تُقرأ مباشرة من الـ closure وقت الاستدعاء — لا تحتاج dep).
- منطق `applyProductInfo` (يعمل بشكل صحيح).
- edge function.

## التحقق

1. فتح Admin → "إضافة منتج" → لصق رابط Bambu → استخراج.
2. التأكد فور انتهاء الاستخراج وبعد ~3 ثوانٍ أن:
   - "المميزات" تظهر بقائمتها
   - "الملخص القصير (SEO)" بالعربي/الإنجليزي/الكردي ممتلئ
   - "كلمات البحث" تحتوي tags
   - "لماذا هذا المنتج" يحتوي محتوى AI
3. اختبار تعديل منتج موجود مع استخراج جديد للتأكد من عدم وجود regression.
