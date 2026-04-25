# خطة: حذف "ربع المبلغ"، توسيع شرائح الدفع الجزئي، وحد كمية 50 لكل منتج

## 1) حذف خيار "ربع المبلغ" نهائياً واستبداله بـ "نصف المبلغ"

**`src/pages/Cart.tsx`**
- تغيير نوع `preOrderPaymentOption` من `'full' | 'quarter' | 'cod'` إلى `'full' | 'half' | 'cod'`.
- تحديث `calculatePartialPaymentFee` و `preOrderPaymentAmount` و `remainingAmount` لاستخدام `0.5` بدلاً من `0.25`.
- تغيير جميع شروط `=== 'quarter'` إلى `=== 'half'`، ونصوص الواجهة من "ربع" إلى "نصف"، وقيم RadioGroup.
- تحديث مفاتيح الترجمة (`cart_preorder_quarter*` → `cart_preorder_half*`) في `src/lib/i18n/*` أو إعادة استخدام مفاتيح half إن وُجدت.

**`src/pages/ChatOrderCheckout.tsx`**
- إزالة `'quarter'` من `PaymentMethod` وكل الشروط/الرسوم/التسميات والـ RadioGroupItem الخاص به (يبقى `wallet | half`).

**`src/pages/CommunityMerchantStore.tsx`**
- حذف عنصر `{ key: 'quarter_payment', label: 'دفع ربع المبلغ' ... }` من قائمة طرق الدفع.

**`src/pages/AdminLevoCommunity.tsx`**
- حذف بطاقة "ربع المبلغ" بالكامل (الحالات `quarterFee/quarterEnabled` والـ Switch والحقل) وإزالتها من `saveMutation.value`.

**`src/hooks/useCommissionSettings.ts`**
- حذف الحقلين `quarter_payment_fee` و `quarter_payment_enabled` من الواجهة والقيم الافتراضية.

## 2) توسيع شرائح الدفع الجزئي من 1 د.ع إلى ما لا نهاية

**Migration على جدول `default_settings`**
- تحديث السجل `partial_payment_settings.fee_tiers` بحيث:
  - أول شريحة `min_amount = 1`
  - آخر شريحة `max_amount = 999999999` (عملياً ∞)
  - الحفاظ على نفس النسب الحالية بين الشرائح.

**`src/pages/Cart.tsx`**
- منطق fallback لـ آخر شريحة موجود مسبقاً ويبقى. مراجعة فقط للتأكد أن المبالغ الصغيرة (1 د.ع) لا تُستثنى من خيار الدفع الجزئي.

**واجهة تحرير الشرائح (إن وُجدت)**
- رفع الحد الأقصى في حقل `max_amount` لقبول قيم كبيرة جداً.

## 3) حد عام ثابت 50 وحدة لكل منتج في السلة

**`src/hooks/useCart.tsx`**
- إضافة ثابت `const MAX_QUANTITY_PER_ITEM = 50;` في أعلى الملف.
- في `addToCart`:
  - إذا وُجد `existingItem`: التحقق `existingItem.quantity + quantity ≤ 50`، وإلا toast: «الحد الأقصى 50 قطعة لكل منتج في السلة» وإرجاع `false`.
  - عند الإدراج الجديد: التحقق `quantity ≤ 50`.
  - في فرع معالجة `23505`: نفس التحقق قبل `updateQuantity`.
- في `updateQuantity`: إذا `quantity > 50` → toast وإرجاع مبكر.
- في فرع البندلز (السطر ~712): تطبيق نفس الحد على `existingBundle.quantity + quantity`.

**واجهة السلة `src/pages/Cart.tsx` و `src/components/GroupedCartItem.tsx`**
- تعطيل زر `+` عند بلوغ 50 مع نص خفيف توضيحي.

## ملاحظات
- لا حاجة لتعديل قاعدة البيانات لحد الكمية (يكفي على مستوى التطبيق + UI).
- الـ migration الوحيد المطلوب هو تحديث `partial_payment_settings.fee_tiers`.
- بعد التطبيق نتحقق بـ `rg "quarter"` من خلو الكود من أي مرجع متبقٍ.