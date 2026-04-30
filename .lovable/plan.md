# قصر مميزات الضمان والتأمين على البيع المباشر فقط

## السلوك المطلوب
كل مميزات الضمان (المجاني) واشتراك خطة الحماية (المدفوعة) وخصم قطع الغيار من خطة الحماية:
- **الخصم النسبي**: يُحسب فقط من إجمالي عناصر `sale_type === 'direct'` (يستثني preorder/sea/air).
- **التوصيل المجاني**: يُمنح فقط إذا كانت كل عناصر العربة (غير الهدايا) من البيع المباشر — لأن الشحن مفرد لكل طلب ولا يمكن "تجزئته".
- **خصم قطع الغيار من خطة الحماية**: العناصر المؤهلة يجب أيضاً أن تكون `direct`.

## التغييرات

### 1. `src/hooks/useCartWarrantyBenefits.tsx`
- داخل `computeDiscount`: فلتر `items` لاستثناء أي عنصر ليس `sale_type === 'direct'` قبل حساب `eligibleSubtotal`. عند غياب whitelist للفئات (الحالة الافتراضية)، نُعيد بناء `eligibleSubtotal` من العناصر `direct` فقط بدل استخدام `cartSubtotal`.
- بعد الحساب: ضبط `freeShipping = false` تلقائياً إذا احتوت العربة على أي عنصر غير-`direct` (ما عدا الهدايا).

### 2. `src/hooks/useCartSubscriptionBenefits.tsx`
- نفس المنطق: حساب `eligibleSubtotal` فقط من العناصر `direct` (مع تطبيق whitelist الفئات إن وجد فوقه).
- ضبط `freeShipping = false` إذا العربة فيها عنصر غير-`direct`.

### 3. `src/hooks/useCartProtectionDiscount.tsx`
- في فلترة `eligibleItems`: اشترط `item.sale_type === 'direct'` بالإضافة لمطابقة الفئة.

## التفاصيل التقنية

دالة مساعدة موحّدة (داخل كل hook، صغيرة بما يكفي لتكرارها):
```ts
const isDirect = (item: CartItem) =>
  (item.sale_type ?? '').toLowerCase() === 'direct';

const cartIsAllDirect = items
  .filter(i => !(i as any).is_gift)
  .every(isDirect);
```

في `useCartWarrantyBenefits.computeDiscount`:
```ts
const directItems = items.filter(i => !(i as any).is_gift && isDirect(i));
let eligibleSubtotal = 0;
for (const item of directItems) {
  const catId = (item.products as any)?.category_id;
  if (discountCats.length === 0 || (catId && discountCats.includes(catId))) {
    eligibleSubtotal += getItemPrice(item) * item.quantity;
  }
}
```

في `useCartSubscriptionBenefits` نفس المعالجة.

في `useCartProtectionDiscount`:
```ts
const eligibleItems = items.filter(item =>
  isDirect(item) &&
  item.products?.category_id &&
  planCategories.includes(item.products.category_id)
);
```

`freeShipping` override (للضمان والاشتراك):
```ts
const allowFreeShipping = cartIsAllDirect;
freeShipping: allowFreeShipping && Number(...max_uses_monthly) > 0,
freeShippingRemainingUses: allowFreeShipping ? remaining : 0,
```

## الملفات المتأثرة
- تعديل: `src/hooks/useCartWarrantyBenefits.tsx`
- تعديل: `src/hooks/useCartSubscriptionBenefits.tsx`
- تعديل: `src/hooks/useCartProtectionDiscount.tsx`
- لا حاجة لتعديل `Cart.tsx` (المنطق محصور داخل الـ hooks).
- لا تغييرات على قاعدة البيانات.

## النتيجة المتوقعة
- عربة فيها preorder + direct: الخصم يُحسب من جزء `direct` فقط، والشحن المجاني **غير مفعّل** (لوجود preorder).
- عربة كلها `direct`: تطبيق كامل لكل المميزات كما السابق.
- عربة كلها preorder: لا خصم ولا شحن مجاني للضمان/الاشتراك.

## تحديث الذاكرة
سيتم تحديث mem://features/hardware/warranty-loyalty-benefits لإضافة قاعدة "Direct sale only" على كل benefits الضمان/التأمين.
