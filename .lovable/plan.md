

## المشكلة

فرق السعر في الخيارات (`price_adjustment`) مخزّن بالدولار ومعروض بعلامة `$`، لكن عند حساب السعر النهائي يُضاف مباشرة للسعر بالدينار العراقي بدون تحويل.

مثال: إذا كان سعر المنتج 50,000 د.ع وفرق الخيار +5$، يصبح السعر 50,005 د.ع بدل ما يجب أن يكون ~56,500 د.ع (بعد تحويل 5$ لعراقي).

## الحل

تحويل `price_adjustment` من دولار إلى دينار عراقي باستخدام سعر الصرف (`usd_to_iqd_rate`) من إعدادات الشحن في كل مكان يُستخدم فيه.

## الملفات المتأثرة

1. **`src/pages/ProductDetail.tsx`** - حساب السعر النهائي + عرض فرق السعر
   - جلب `shippingSettings` عبر `useShippingSettings`
   - تحويل `optionAdjustment` بضربه بسعر الصرف: `optionAdjustment * rate`
   - تحديث عرض فرق السعر في UI (تحويله وعرضه بالدينار بدل الدولار)

2. **`src/pages/Cart.tsx`** - حساب سعر العنصر عند الطلب وعند العرض
   - جلب سعر الصرف وتحويل `price_adjustment` في جميع المواضع (~5 مواضع)

3. **`src/components/community/AddToCartSheet.tsx`** - حساب السعر الحالي وعرض الخيارات
   - تحويل `price_adjustment` عند حساب `currentPrice`
   - تحديث عرض فرق السعر

4. **`src/components/CartRequestDialog.tsx`** - حساب سعر العنصر

5. **`src/pages/ProductOffersPage.tsx`** و **`src/components/ProductOfferDetailModal.tsx`** - عروض المنتجات (إن كانت تستخدم أسعار IQD)

## التفاصيل التقنية

- سيتم استيراد `useShippingSettings` من `@/hooks/useShippingCalculator` في الملفات التي تحتاجه
- صيغة التحويل: `Math.round(price_adjustment_usd * usd_to_iqd_rate)`
- عرض فرق السعر في UI سيتحول من `+5$` إلى `+6,500 د.ع` (مثلاً)
- في حال عدم توفر سعر الصرف، يُستخدم fallback (مثلاً 1300)

