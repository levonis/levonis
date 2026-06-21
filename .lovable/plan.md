## الأهداف

1. سعر الخيار/اللون يصبح **سعر مستقل** (يستبدل السعر الأساسي عند تحديده، وإذا تُرك فارغًا يُستخدم سعر المنتج الأساسي).
2. **سعر التكلفة للخيار = نفس سعر بيع الخيار** (حقل واحد فقط بدل اثنين منفصلين).
3. إخفاء جميع المنتجات الحالية فورًا (`is_pricing_updated = false`) حتى يُحدّثها الإدمن.
4. عرض **آخر تحديث سعر** للمنتج. إذا مرّ **60 يومًا** بدون تحديث، يختفي تلقائيًا عن المستخدمين ويظهر في قائمة "يتطلب تحديث سعر" للإدمن/المساعد.
5. زر سريع ⚡ في جدول المنتجات يفتح نافذة منبثقة لتعديل **حقول التكلفة فقط** للمنتج + كل خيار/لون.

---

## التغييرات

### 1) قاعدة البيانات (migration واحدة)

- `products`: إضافة عمود `last_price_update timestamptz` (يُحدَّث عبر trigger عند تغيّر أي حقل سعر/تكلفة، أو عند تغيّر `product_options` المرتبطة).
- `products`: ضبط `is_pricing_updated = false` لكل الصفوف الحالية، وتعيين `last_price_update = NULL`.
- `product_options`: استخدام `price_adjustment` كـ **سعر مستقل** (إعادة تفسير دلاليّ). القيمة `NULL` أو `0` = استخدم سعر المنتج الأساسي. حذف `cost_iqd` و`cost_usd` من واجهة الإدخال — التكلفة = نفس قيمة السعر (سيتم حسابها عند الحاجة من `price_adjustment`).
- Trigger: عند `UPDATE` على `products` أو على `product_options` (insert/update/delete) → `last_price_update = now()` على المنتج. أيضًا عند `is_pricing_updated` ينتقل من `false` إلى `true` → ضبط `last_price_update = now()`.
- Cron/RPC: دالة `auto_hide_stale_priced_products()` تشتغل يوميًا — إذا `now() - last_price_update > 60 days` تضع `is_pricing_updated = false`.
- View/RPC للإدمن: قائمة المنتجات التي `is_pricing_updated = false` مرتبة بـ `last_price_update` تصاعديًا.

### 2) منطق السعر (Frontend + Cart)

- `src/lib/cardPrice.ts`, `src/lib/priceGuard.ts`, `src/components/GroupedCartItem.tsx`, `src/pages/Cart.tsx`, `src/pages/ProductDetail*`, دوال السعر الموحّد:
  - استبدال نمط **"base + price_adjustment"** بـ **"price_adjustment أو base عند فراغه"**.
  - عند الجمع بين عدّة خيارات (لون + نوع) → استخدام **آخر خيار له سعر مستقل** أو حسب القاعدة: إذا أي خيار له سعر → يُجمع كاستبدال للأساس؟ **يلزم سؤال صغير** (انظر أسفل).
- تحديث `direct_sale_price` server-side function لتعكس المنطق الجديد.
- تحديث الاختبارات: `cartItemGuards`, `priceGuard.codSync`, `cardPrice.parity`.

### 3) واجهة الإدمن

- **AdminProductForm / Options Editor**: 
  - تسمية الحقل تتحول من "إضافة على السعر" إلى **"سعر مستقل (اتركه فارغًا لاستخدام السعر الأساسي)"**.
  - حذف حقول `cost_iqd` / `cost_usd` للخيارات من النموذج (التكلفة = السعر تلقائيًا).
- **ProductsTable** (`src/components/admin/ProductsTable.tsx`):
  - عمود جديد: **آخر تحديث سعر** (تاريخ + شارة "متأخر" إذا > 60 يوم).
  - فلتر جديد: "يتطلب تحديث سعر".
  - زر سريع ⚡ بجانب أزرار الإجراءات → يفتح `QuickCostEditDialog` يعرض:
    - حقل تكلفة المنتج الأساسي.
    - جدول بكل خيار/لون مع حقل تكلفة واحد (= السعر) لكل صفّ.
    - زر حفظ → يُحدِّث القيم ويضع `is_pricing_updated = true` و `last_price_update = now()`.

### 4) صفحة الإدمن "يتطلب تحديث سعر"

- تبويب/قائمة جديدة (أو إعادة استخدام فلتر `is_pricing_updated=false`) مرتّبة بالأقدم تحديثًا، مع زر سريع لفتح نفس `QuickCostEditDialog`.

---

## ملف التغييرات

```text
supabase/migrations/<new>.sql         (last_price_update, trigger, cron, bulk reset)
src/components/admin/ProductsTable.tsx   (عمود + فلتر + زر ⚡)
src/components/admin/QuickCostEditDialog.tsx  (جديد)
src/components/admin/ProductForm/...     (تسمية الحقل + حذف cost منفصل للخيار)
src/lib/cardPrice.ts                  (منطق السعر المستقل)
src/lib/priceGuard.ts                 (نفس المنطق)
src/components/GroupedCartItem.tsx    (تحديث)
src/pages/Cart.tsx                    (تحديث)
src/lib/__tests__/*                   (تحديث المتوقعات)
```

---

## سؤال يحتاج توضيح قبل التنفيذ

عندما يحتوي المنتج على **خيارَين** كلاهما له سعر مستقل (مثلًا لون «بني» = 12,000 و تعبئة «بدون رولة» = 6,250)، كيف تريد الحساب؟

- (أ) **آخر خيار له سعر يَفُوز** (استبدال كامل).
- (ب) **جمع الأسعار المستقلة معًا** بدل السعر الأساسي (مثلًا 12,000 + 6,250 = 18,250). ← يطابق مثال 18,250 السابق.
- (ج) خيار واحد فقط (اللون) يحدد السعر، الثاني (التعبئة) يبقى مضافًا/مخفّضًا بقيمة ثابتة.

سأمضي بـ **(ب)** افتراضيًا (لأنه يطابق المثال 18,250 الذي ذكرتَه سابقًا) ما لم تخبرني بغير ذلك.
