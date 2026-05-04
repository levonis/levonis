## الهدف
في بطاقات صفحة `/category/:slug` (وكذلك بطاقة المنتج المميز والمنتجات المرتبطة في صفحة التفاصيل) يجب عرض **أقل سعر متاح فعلياً** للمستخدم — حسب الخيارات (options) الموجودة، سواء كان البيع مباشر أو حجز مسبق — بدلاً من السعر الأساسي فقط.

## السلوك الحالي
`computeUnifiedCardPrice` في `src/pages/CategoryDetail.tsx` يحسب سعراً واحداً (direct أو preorder) بناءً على `direct_sale_price`/RPC أو `sea_price`/`air_price`، **متجاهلاً `price_adjustment` للخيارات**. النتيجة: البطاقة تعرض سعر "بدون خيار"، بينما صفحة التفاصيل قد تعرض سعراً أقل عند اختيار خيار رخيص.

## التغييرات

### 1. `src/pages/CategoryDetail.tsx`

**أ. توسيع جلب البيانات** — في `useQuery` الخاص بـ `category-products`، عدّل الجزء `product_options(...)` ليشمل تعديل السعر:
```
product_options(name_ar, price_adjustment, stock_quantity, available_for_direct_sale)
```

**ب. إعادة كتابة `computeUnifiedCardPrice`** بحيث:
1. تحسب **سعر القاعدة للبيع المباشر** (RPC الحي → `direct_sale_price` → fallback) إذا `has_in_stock` ولم ينضب المخزون.
2. تحسب **سعر القاعدة للحجز المسبق** من `sea_price`/`air_price` (الأدنى عند `both`) إذا `has_pre_order`.
3. لكل قاعدة موجودة، تجمع قائمة "تعديلات الخيارات المتاحة":
   - **للبيع المباشر**: الخيارات التي `available_for_direct_sale !== false` ولديها `stock_quantity > 0` (أو يوجد مخزون من الألوان `option_stocks` كما يفعل ProductDetail).
   - **للحجز المسبق**: كل الخيارات (الحجز المسبق لا يتطلب مخزون).
   - إذا لا توجد خيارات للمنتج، نعتبر التعديل = 0.
4. تحوّل كل `price_adjustment` عبر `ensureAdjustmentIqd(adj, usdToIqd, price_usd)`.
5. لكل قاعدة: `candidate = base + min(adjustments_available)`. إذا لا توجد خيارات متاحة لذلك النوع، تتجاهله.
6. النتيجة النهائية = **أدنى candidate** بين الاثنين، ثم تطبق `round_up_price` (250 IQD) إن كان مفعّلاً.

**ج. السعر الأصلي المشطوب**: يبقى مخفياً إذا كان أقل من السعر النهائي (السلوك الحالي).

### 2. بطاقة المنتج المميز (`featuredProduct`) في نفس الملف
تستخدم نفس `computeUnifiedCardPrice` الجديد بدلاً من المنطق المحلي الحالي حول السطر 437.

### 3. `src/pages/ProductDetail.tsx` — قسم المنتجات المرتبطة
نفس الدالة الجديدة (تُستخرج إلى `src/lib/priceGuard.ts` كـ `computeLowestCardPrice` لإعادة الاستخدام)، وتُستخدم في حلقة عرض `FloatingProductCard` للمنتجات المرتبطة. يجب توسيع جلب المنتجات المرتبطة لتشمل نفس حقول `product_options`.

### تفاصيل تقنية
- نوع `option_stocks` على الألوان للبيع المباشر يُحسب كما في `ProductDetail.getOptionStockFromColors` (لو احتجنا الدقة الكاملة، نمرر `colors` للدالة وننفّذ نفس المنطق المختصر).
- لا تغييرات على RPC أو DB.
- لا حاجة لجلب أسعار حية لكل خيار — `price_adjustment` مخزّن مع الخيار ذاته.

## النتيجة
بطاقة `H2C` (وغيرها) ستعرض **أدنى سعر يمكن للمستخدم فعلياً شراء المنتج به**، مطابقاً لما سيراه في صفحة التفاصيل عند اختيار أرخص خيار متاح.
