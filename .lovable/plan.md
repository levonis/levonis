## الهدف
ضمان تطابق **السعر** و**السعر الأصلي** بين بطاقة المنتج (`/category/:slug` + المنتجات المرتبطة) وبين صفحة التفاصيل في كل الحالات، عبر:
1. توحيد منطق الحساب في موضع واحد (مصدر حقيقة وحيد).
2. فحص تلقائي أثناء التشغيل (Dev) يحذّر عند وجود انحراف.
3. اختبارات وحدة (Vitest) تغطي السيناريوهات الرئيسية.

## التغييرات

### 1. ملف مشترك جديد: `src/lib/cardPrice.ts`
ينقل `computeUnifiedCardPrice` من `CategoryDetail.tsx` إلى ملف مشترك، ويضيف:

```ts
export function computeUnifiedCardPrice(product, usdToIqd, codDefaults, liveDirectMap): number
export function computeUnifiedCardOriginalPrice(product, usdToIqd): number | null
```

- `computeUnifiedCardPrice`: نفس المنطق الحالي (أدنى مرشح بين direct + preorder، مع `getMinOptionAdjustmentIqd`، ثم `round_up_price`).
- `computeUnifiedCardOriginalPrice`: يعيد `original_price` بعد `ensurePriceIqd` و `round_up_price`، أو `null` إذا غير موجود/أقل من السعر النهائي.

### 2. `src/pages/CategoryDetail.tsx`
- حذف الدالة المحلية واستبدالها بـ `import { computeUnifiedCardPrice, computeUnifiedCardOriginalPrice } from '@/lib/cardPrice'`.
- استخدام `computeUnifiedCardOriginalPrice` بدلاً من حساب `fpOriginal`/`rawOrig` المحلي في بطاقة المنتج المميز.

### 3. `src/pages/ProductDetail.tsx` — استخدام نفس الدالة في المنتجات المرتبطة
استبدال كتلة الحساب الطويلة (السطور 1368–1432) بـ:
```tsx
const finalPrice = computeUnifiedCardPrice(rp, usdToIqd, codDefaults, relatedLiveDirectMap);
const showOrig = computeUnifiedCardOriginalPrice(rp, usdToIqd) ?? undefined;
```

### 4. فحص تلقائي للتكافؤ (Dev only) في `src/pages/ProductDetail.tsx`
بعد حساب `finalPrice` و `finalOriginalPrice` للمنتج الرئيسي، نضيف `useEffect` يعمل فقط في `import.meta.env.DEV`:

```ts
useEffect(() => {
  if (!import.meta.env.DEV || !product) return;
  const cardPrice = computeUnifiedCardPrice(product, usdToIqd, codDefaults, /* mainLiveMap */);
  // The card should equal the cheapest possible detail combination
  const expectedMin = computeMinDetailPrice(product, productOptions, usdToIqd, codDefaults, mainLiveMap);
  if (cardPrice !== expectedMin) {
    console.warn('[Price Parity] mismatch on', product.slug, { cardPrice, expectedMin });
  }
  const cardOrig = computeUnifiedCardOriginalPrice(product, usdToIqd);
  // Compare to detail's finalOriginalPrice computed for cheapest option
  // ... similar warn
}, [product, productOptions, usdToIqd, codDefaults]);
```

ملاحظة: سيُحتسب `expectedMin` عبر تطبيق نفس قاعدة "أرخص خيار متوفر" التي تستخدمها `computeUnifiedCardPrice` على بيانات `productOptions` المُحمَّلة كاملةً في صفحة التفاصيل. أي اختلاف يعني انحراف بين منطقَي الكارد والتفاصيل.

### 5. اختبارات Vitest جديدة: `src/lib/__tests__/cardPrice.parity.test.ts`
تغطي:
- منتج بسعر قاعدة فقط (بدون خيارات/ألوان).
- منتج فيه `direct_sale_price` بدون خيارات.
- منتج بخيارات بأسعار موجبة وسالبة → يتحقق أن البطاقة = base + min(adjustments).
- منتج بـ `link_direct_commission_to_cod` مع `liveDirectMap`.
- منتج preorder فقط بـ `sea/air/both`.
- منتج له direct + preorder، direct أرخص → يختار direct، والعكس.
- `round_up_price = true` → التقريب إلى 250.
- `original_price` أقل من النهائي → يُعيد `null`.
- `original_price` أكبر من النهائي → يُعيد القيمة المقربة.

كل اختبار يتأكد أن `computeUnifiedCardPrice(product, ...)` == السعر الذي ستحسبه صفحة التفاصيل لأرخص خيار متوفر (محاكاة يدوية).

## النتيجة
- مصدر حقيقة وحيد لمنطق سعر البطاقة → استحالة الانحراف عبر النسخ/اللصق.
- تحذير فوري في Dev console عند أي تسريب مستقبلي.
- شبكة أمان من اختبارات Vitest تُشغَّل تلقائياً.

## ملفات متأثرة
- `src/lib/cardPrice.ts` (جديد)
- `src/lib/__tests__/cardPrice.parity.test.ts` (جديد)
- `src/pages/CategoryDetail.tsx` (تنظيف + استيراد)
- `src/pages/ProductDetail.tsx` (تبسيط الكتلة + فحص Dev)
