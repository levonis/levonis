## السبب الجذري الفعلي

`extract-product-info` يُرجِع الأبعاد فعلاً (اللوغات تؤكد: `Dimensions: {length_cm:30,width_cm:30,height_cm:0.5}`)، والحدث `admin-product-pricing-autofill` يصل ويُحدّث الـ state.

**لكن** في `src/components/admin/AdminProductPricingSection.tsx` السطر 112-162، الـ `useEffect` الذي يقرأ من `editingProduct` يعتمد على:

```ts
}, [editingProduct, shippingSettings?.usd_to_iqd_rate]);
```

عند الاستخراج لمنتج جديد يحدث التسلسل التالي:
1. الحدث autofill يُطلق → `setLengthCm(30)` ✓
2. خلال ثوانٍ `shippingSettings` يعود من React Query أو يتغيّر بـ realtime → الـ effect يُعاد تنفيذه → يقرأ `editingProduct.length_cm` (= `undefined` لمنتج جديد) → **يدوس على القيم ويرجعها 0** ✗

نفس المشكلة تنطبق على `widthCm/heightCm/weightKg/originalPriceIqd` وكل الحقول الأخرى.

## الإصلاح

### `src/components/admin/AdminProductPricingSection.tsx`

1. **فصل الـ effect إلى اثنين** بدلاً من واحد مزدوج التبعيات:
   - **Effect A**: يهيّئ كل الحقول من `editingProduct` فقط، deps = `[editingProduct]` (يعمل عند فتح المنتج، لا يُعاد عند تحديث الإعدادات).
   - **Effect B** (موجود فعلاً في سطر 166-173): يتعامل مع `usd_to_iqd_rate` لتحويل `original_price_usd` القديم إلى IQD. سننقل إليه الحالة الوحيدة التي تعتمد على السعر:
     ```ts
     // داخل Effect B الموجود:
     if (editingProduct && !editingProduct.original_price && editingProduct.original_price_usd > 0 && rate > 0) {
       setOriginalPriceIqd(Math.round(editingProduct.original_price_usd * rate));
     }
     ```

2. **حماية إضافية لمنع الدوس على قيم الاستخراج**: نُضيف ref `extractedRef` يُضبط `true` عند استقبال حدث `admin-product-pricing-autofill`، وفي Effect A نتخطّى إعادة تعيين الأبعاد/الوزن إذا كان `extractedRef.current === true` و`editingProduct.length_cm` فارغ (أي لا يوجد مصدر حقيقي ليُعاد منه).

3. الإبقاء على باقي التهيئة كما هي (الأسعار/العمولات/التواقيع).

### لا تغييرات في:
- `src/pages/Admin.tsx` (الـ dispatch صحيح)
- edge function `extract-product-info` (يعمل بشكل سليم — اللوغات تؤكد)
- قاعدة البيانات

## التحقق

1. فتح Admin → "إضافة منتج" → لصق رابط Bambu → الضغط على استخراج.
2. التأكد أن قسم "البحري" يُفتح تلقائياً والحقول الطول/العرض/الارتفاع/الوزن مملوءة بالأرقام المستخرجة (30/30/0.5/0.5).
3. الانتظار ~3 ثوانٍ للتأكد أن القيم لا تُمسح بعد تحميل `shippingSettings`.
4. التحقق أن سطر "تكلفة الشحن البحري/الجوي" يُحسب فوراً.
5. اختبار نفس الشيء على منتج موجود (edit) للتأكد أن لا regression.
