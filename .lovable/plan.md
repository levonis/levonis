# خطة: خيارات مدة الاشتراك مع خصم تصاعدي

## نظرة عامة
عند الضغط على "اشترك الآن" أو "ترقية" لأي بطاقة ليفو أو خطة حماية، يفتح مربع حوار يعرض 4 خيارات مدة (1، 3، 6، 12 شهر) مع نسبة خصم لكل مدة يتحكم بها الأدمن. الدفع يتم دفعة واحدة مقدماً.

## 1) قاعدة البيانات

جدول جديد للتحكم المركزي:
```
subscription_duration_tiers
- id, target_type ('card' | 'protection_plan')
- duration_months (1, 3, 6, 12)
- discount_percentage (numeric)
- label_ar/en/ku (اختياري: "الأكثر شعبية"، "أفضل قيمة")
- is_active, display_order
```

بذر افتراضي:
- 1 شهر → 0%
- 3 شهور → 5%
- 6 شهور → 10%
- 12 شهر → 20%

تحديث `user_cards` بحقول: `duration_months`, `total_paid`, `discount_percentage_applied`.
تحديث `printer_subscriptions`: بالفعل يحوي `monthly_price`؛ نضيف `duration_months`, `total_paid`, `discount_percentage_applied`, والحقل `end_date` يُحسب من المدة.

## 2) لوحة الإدارة
صفحة/تبويب جديد `AdminSubscriptionTiers`:
- جدول للبطاقات (target_type='card') وجدول لخطط الحماية.
- تعديل مباشر لنسبة الخصم وتفعيل/تعطيل كل مدة.
- Verify-and-Rollback عند التبديل (وفق المعيار).

الوصول من: Admin Hub → إعدادات الاشتراكات.

## 3) واجهة المستخدم

### أ) بطاقات ليفو (`LevoCardManager` / زر شراء البطاقة)
يفتح `SubscriptionDurationDialog` يعرض:
- 4 بطاقات مدة (1/3/6/12 شهر)
- لكل بطاقة: السعر الأصلي (شهري × عدد الأشهر)، نسبة الخصم، السعر النهائي، التوفير
- شارة "الأكثر شعبية" على 3 شهور، "أفضل قيمة" على 12 شهر
- خيار الدفع: نقاط أو محفظة (حسب توفر `price_points`/`wallet_price`)
- زر "تأكيد الاشتراك"

عند التأكيد: خصم فوري من المحفظة/النقاط، إنشاء صف في `user_cards` مع `expires_at = now() + duration_days*months/1`.

### ب) خطط الحماية (`AllPlansPanel`)
نفس `SubscriptionDurationDialog` (قابل لإعادة الاستخدام) لكن target_type='protection_plan':
- يستبدل toast الحالي `t('ap_subscribe_form')`
- يعرض المدد الأربع بنفس التصميم
- عند التأكيد: يطلب من المستخدم اختيار الطابعة المرتبطة، ثم يُنشئ `printer_subscriptions` مع `end_date`، `total_paid`، وخصم من المحفظة.

## 4) منطق الحساب (مشترك)
```
basePrice = card.wallet_price OR plan.monthly_price
gross = basePrice × duration_months
discount = gross × (tier.discount_percentage / 100)
final = round(gross - discount, nearest 250 IQD)  // حسب معيار التقريب
savings = gross - final
```
حساب موحّد في `src/lib/subscriptionPricing.ts` مع اختبارات Vitest.

## 5) i18n
مفاتيح جديدة في ar/en/ku:
`sub_duration_1m`, `sub_duration_3m`, `sub_duration_6m`, `sub_duration_12m`, `sub_save_percent`, `sub_most_popular`, `sub_best_value`, `sub_total`, `sub_original`, `sub_confirm`, `sub_choose_duration`.

## 6) الملفات المتأثرة

**جديدة:**
- `supabase/migrations/…_subscription_duration_tiers.sql`
- `src/components/subscriptions/SubscriptionDurationDialog.tsx`
- `src/lib/subscriptionPricing.ts` + اختبارات
- `src/pages/AdminSubscriptionTiers.tsx`
- `src/hooks/useSubscriptionTiers.ts`

**معدلة:**
- `src/components/rewards/LevoCardManager.tsx` (استخدام الحوار)
- `src/components/rewards/panels/AllPlansPanel.tsx` (استبدال toast)
- `src/App.tsx` (route الأدمن الجديد)
- `src/lib/i18n/*` (مفاتيح جديدة)
- ملف الذاكرة `mem://features/rewards/subscription-duration-tiers.md`

## ملاحظات تقنية
- الخصم على `card_discount_limits`/`plan_discount_usage` الشهرية يبقى كما هو (خصم على الشراء، ليس على المنافع).
- التجديد التلقائي `auto_renew` يستخدم آخر مدة/نسبة خصم مختارة.
- كل إدراج جديد في جدول عام يشمل GRANT + RLS وفق المعيار.
