## السبب الجذري

عند المنتجات التي تدعم أكثر من نوع شحن مسبق (مثلاً جوي + بحري + بري)، صفحة المنتج (`ProductDetail.tsx` السطور 681–699) تبني خيارات شحن "احتياطية" داخل الواجهة فقط (`fallbackOpts`) — لا تُحفظ هذه الخيارات في `product.pre_order_shipping_options` في قاعدة البيانات.

عند إضافة المنتج إلى السلة:
- يُحفظ فقط `shipping_option_index` (مثلاً `1` للجوي).
- **لا يُحفظ نوع الشحن المختار (`sea`/`air`/`land`) في `cart_items`**.

عند احتساب سعر السلة (`getGuardedCartItemPrice` في `src/lib/priceGuard.ts` السطور 335–356 و 380–385):
- يحاول قراءة `product.pre_order_shipping_options[index].price_adjustment` لكن المصفوفة فارغة → الإضافة = 0.
- ولأن المنتج يدعم عدة أنواع، يأخذ الكود `Math.min(sea, air, land)` كقاعدة → يُعرض السعر الأرخص دائماً.

النتيجة المطابقة لمثال المستخدم: المنتج جوي = 18,250 / بحري = 12,250 → الصفحة تعرض الاختيار الفعلي (الجوي) 18,250، بينما السلة تعرض الأرخص (البحري) 12,250.

## خطة الإصلاح

### 1) حفظ نوع الشحن المختار على عنصر السلة
`src/hooks/useCart.tsx` — تعديل توقيع `addToCart` / `forceAddToCart` ليقبل `shippingInfo.type?: 'sea' | 'air' | 'land'` وكتابته إلى عمود `cart_items.shipping_type` عند الإدراج. (العمود موجود ومُستهلك بالفعل.)

`src/pages/ProductDetail.tsx` — عند بناء `shippingInfo` (السطر ~704) تمرير `type` من `allShippingOpts[selectedShippingOption].type` (موجود مسبقاً في `fallbackOpts`، وللخيارات المخزنة سنقرأ `type` إن وُجد).

### 2) ضبط حساب السعر في السلة لاحترام النوع المختار
`src/lib/priceGuard.ts` داخل `getGuardedCartItemPrice`:
- استبدال السطر 336 ليُفضّل `item.shipping_type` قبل `product.shipping_type`.
- عند وجود أكثر من توكن وكان `item.shipping_type` يحدد توكن واحد (sea/air/land) → استخدام سعر ذلك النوع مباشرة بدل `Math.min` على كل المرشحين.
- كحل احتياطي إن لم يكن `item.shipping_type` محفوظاً (عناصر قديمة في السلة) وكانت `pre_order_shipping_options` فارغة و`shipping_option_index` معرّف: إعادة بناء قائمة fallback بنفس ترتيب `ProductDetail` (sea → air → land حسب التوكنات الفعالة) ثم اختيار العنصر بالـ index واستخدام سعر نوعه مباشرة.

### 3) ترحيل بيانات السلة الحالية (اختياري بسيط)
ترحيل SQL يملأ `cart_items.shipping_type` للعناصر الموجودة بناءً على `shipping_option_index` و `products.shipping_type` (sea/air/land بنفس ترتيب التوكنات) حتى لا يحتاج المستخدمون الحاليون لإعادة الإضافة.

## ملفات ستُعدَّل

- `src/hooks/useCart.tsx` — توسيع توقيع `shippingInfo` وكتابة `shipping_type` عند الإدراج.
- `src/pages/ProductDetail.tsx` — تمرير `type` ضمن `shippingInfo`.
- `src/lib/priceGuard.ts` — منطق احترام `item.shipping_type` + الاحتياطي عبر index.
- ملف ترحيل SQL جديد — تعبئة `cart_items.shipping_type` للسجلات القديمة.

## التحقق

- منتج بـ `shipping_type='sea,air'`، sea=12,250 / air=18,250: اختيار الجوي في الصفحة → السلة تعرض 18,250 (سابقاً 12,250). ✅
- منتج بشحن واحد فقط: لا تغيير. ✅
- منتج بيع مباشر (direct): لا تغيير، المسار منفصل في الدالة. ✅
- خيارات منتج (`price_adjustment`): تُضاف فوق سعر النوع المختار كما كان. ✅
- البيع المسبق مع `pre_order_shipping_options` مخزنة فعلياً: السلوك الحالي محفوظ. ✅
