
The user wants the per-product COD toggle to use ONLY the global default fee (no per-product fee_type/fee_value override). Toggle = on/off only; fee always comes from global settings.

## التغيير

**1) `AdminProductPricingSection.tsx`** — قسم الطلب المسبق:
- إبقاء Switch واحد فقط: "تفعيل الدفع عند الاستلام لهذا المنتج"
- إزالة حقول نوع العمولة وقيمتها من واجهة المنتج
- إزالة الـ hidden inputs الخاصة بـ `cod_fee_type` و `cod_fee_value` (أو إرسالها فارغة `null`)
- إضافة ملاحظة: "النسبة/القيمة تُؤخذ تلقائياً من إعدادات الدفع عند الاستلام الافتراضية"

**2) `Cart.tsx`** — حساب رسوم COD:
- استخدام `defaultType` و `defaultVal` من `cod_settings` فقط لكل منتج
- إزالة قراءة `item.products.cod_fee_type` و `item.products.cod_fee_value`
- المنطق الجديد:
  ```ts
  const codFee = items.reduce((sum, item) => {
    const lineTotal = getCartItemPrice(item) * item.quantity;
    return sum + (defaultType === 'percentage' 
      ? Math.ceil(lineTotal * defaultVal / 100) 
      : defaultVal * item.quantity);
  }, 0);
  ```

**3) `useCart.tsx`** — إزالة `cod_fee_type, cod_fee_value` من استعلام المنتج (إبقاء `cod_enabled` فقط).

**4) `AdminPartialPaymentSettings.tsx`** — لا تغيير (الإعدادات موجودة بالفعل).

## النتيجة
- صفحة المنتج: مفتاح ON/OFF فقط
- مصدر النسبة الوحيد: `/cp-x9A3kL7m/partial-payment-settings`
- تغيير النسبة في الإعدادات يُطبَّق فوراً على كل منتجات COD

## ملفات ستُعدّل
- `src/components/admin/AdminProductPricingSection.tsx`
- `src/pages/Cart.tsx`
- `src/hooks/useCart.tsx`

(الأعمدة `cod_fee_type` و `cod_fee_value` في قاعدة البيانات تبقى موجودة دون استخدام — لا حاجة لـ migration.)
