## الهدف
تحويل دلالة `product_options.price_adjustment` من **«مبلغ يُضاف على السعر الأساسي»** إلى **«سعر مستقل يستبدل السعر الأساسي»**، وتحديث القاعدة المحفوظة. السلوك عند خيارين أو أكثر = **جمع الأسعار المستقلة بدلًا من السعر الأساسي** (كما أكدتَ سابقًا: 12,000 + 6,250 = 18,250).

## القاعدة الجديدة

| الحالة | السلوك |
|---|---|
| لا يوجد خيار محدد | استخدم سعر المنتج الأساسي |
| خيار واحد مع `price_adjustment > 0` | استخدم القيمة كـ **سعر نهائي** للوحدة |
| خيار واحد بقيمة فارغة/صفر | استخدم سعر المنتج الأساسي |
| عدة خيارات (لون + نوع) لكل منها سعر | **مجموع الأسعار المستقلة** يستبدل السعر الأساسي |
| عدة خيارات بعضها فارغ | الأساس + مجموع الأسعار المستقلة فقط (الفارغ يُحسب أساسًا) ← يحتاج تأكيد، انظر السؤال أدناه |

## التغييرات في الكود

### 1) `src/lib/priceGuard.ts`
- استخراج helper `resolveOptionPriceIqd(item, productBaseIqd, usdToIqd, priceUsd)` يطبّق القاعدة الجديدة.
- في `getGuardedCartItemPrice`: بعد حساب `price` الأساسي (خطوات 1–3 الحالية)، استبدال الخطوة 4 (`+= optAdj`):
  - إذا للخيار قيمة > 0 → **استبدل** `price` بقيمة الخيار (مع التحويل من USD عند الحاجة).
  - شحن ما قبل الطلب (`shipping_option_index` adjustment) يبقى كما هو.

### 2) `src/lib/priceGuard.ts` — `getMinOptionAdjustmentIqd`
- إعادة تسمية دلاليّة إلى `getMinOptionOverridePriceIqd` تُعيد **سعر الخيار الأرخص** (وليس فرقًا).
- تُستخدم في `cardPrice.ts` لاختيار أقل سعر بطاقة. منطق البطاقة:
  - إذا توجد خيارات مع `price > 0` → السعر = **min(أسعار الخيارات المؤهلة)**.
  - وإلا → السعر الأساسي للمنتج.

### 3) `src/lib/cardPrice.ts`
- استبدال `directBase + getMinOptionAdjustmentIqd(...)` بـ:
  ```ts
  const minOverride = getMinOptionOverridePriceIqd(product, 'direct', usdToIqd);
  candidates.push(minOverride ?? directBase);
  ```
- نفس الشيء للـ pre-order.

### 4) جمع عدة خيارات في السلة (لون + نوع)
- بُنية `cart_items` تربط خيارًا واحدًا فقط (`product_option_id`). الخيار الثاني يأتي عبر `selected_color` من جدول `products.colors` (JSON). 
- منطق اللون موجود أصلًا في خطوة 3 من `getGuardedCartItemPrice` (`colorData.price`/`direct_sale_price`).
- التعديل: عند وجود **سعر لون مستقل** + **سعر خيار مستقل** → **جمعهما** بدلًا من الأساس:
  ```ts
  const colorPrice = (colorData?.price ?? colorData?.direct_sale_price) ? ensurePriceIqd(...) : null;
  const optionPrice = optAdj ? ensureAdjustmentIqd(optAdj, ...) : null;
  if (colorPrice != null && optionPrice != null) price = colorPrice + optionPrice;
  else if (colorPrice != null) price = colorPrice;
  else if (optionPrice != null) price = optionPrice;
  // else: keep base
  ```

### 5) واجهة الإدمن — نموذج إضافة خيار
- تغيير تسمية الحقل من «إضافة على السعر» إلى **«سعر مستقل للخيار (اتركه فارغًا = السعر الأساسي)»**.
- حذف حقول `cost_iqd` / `cost_usd` من نموذج الخيار (التكلفة = نفس السعر، تُحفظ تلقائيًا في DB).
- مكوّن المعاينة `OptionPricePreview` (سطر 113 من Admin.tsx) يُحدَّث: يعرض **القيمة كسعر نهائي** بدلًا من «الأساس + الإضافة».

### 6) `direct_sale_price` على السيرفر
- لا تغيير في حساب `direct_sale_price` نفسه (هو سعر المنتج الأساسي قبل الخيار).
- منطق الاستبدال يحدث client-side في الكارت/البطاقة فقط.

### 7) الاختبارات
- `src/lib/__tests__/priceGuard.codSync.test.ts` — تحديث متوقعات الاختبار للخيار المستقل.
- `src/lib/__tests__/cardPrice.parity.test.ts` — اختبار جديد: خيار 18,250 → البطاقة تعرض 18,250 وليس base + 18,250.
- `src/lib/__tests__/cartItemGuards.test.ts` — تحديث.
- اختبار جديد: لون مستقل + خيار مستقل = مجموع.

### 8) تحديث الذاكرة (`mem://index.md`)
- استبدال السطر:
  > **Option Prices**: `price_adjustment` is in IQD. NEVER multiply by USD exchange rate. Add directly to converted base.

  بسطر جديد:
  > **Option Prices**: `price_adjustment` is the option's **independent IQD price** (replaces base when > 0). Multiple option/color overrides **sum** to replace base. Empty/0 = use base.

  وتحديث ملف الذاكرة التفصيلي `mem://constraints/pricing/product-option-currency`.

## ملف التغييرات
```text
src/lib/priceGuard.ts                       (المنطق الجوهري)
src/lib/cardPrice.ts                        (استخدام الـ helper الجديد)
src/pages/Admin.tsx                         (تسمية الحقل + OptionPricePreview)
src/components/admin/QuickCostEditDialog.tsx (placeholder النص فقط)
src/lib/__tests__/*                         (تحديث + إضافة)
mem://index.md, mem://constraints/pricing/... (تحديث الذاكرة)
```

## سؤال واحد قبل البدء
عندما يحتوي المنتج على خيارَين والمستخدم اختار خيارًا له سعر مستقل (مثلًا «بني» = 12,000) **والخيار الثاني فارغ** («تعبئة افتراضية» بدون سعر مستقل):

- (1) السعر النهائي = **12,000** فقط (الفارغ = صفر، لا يضاف الأساس).
- (2) السعر النهائي = **الأساس + 12,000** (الفارغ = أساس).
- (3) السعر النهائي = **12,000** ويُتجاهل الأساس تمامًا (المنتقى يحدد كل شيء).

الخيار **(1)** يطابق المثال (12,000 + 6,250 = 18,250) أكثر — سأمضي به افتراضيًا.
