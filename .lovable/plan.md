

## خطة تحويل "هدايا التجار" إلى "المساعدات" - صفحة شاملة بأربعة أقسام

### نظرة عامة
تحويل صفحة `/merchant-giveaways` إلى صفحة "المساعدات" متعددة الأقسام مع إضافة زر وصول واضح من مجتمع ليفو. الصفحة متاحة للتجار الموثقين فقط.

---

### التفاصيل التقنية

#### 1. جداول قاعدة البيانات الجديدة

**جدول `assistance_coupons`** - كوبونات محدودة قابلة للتحصيل:
- `id`, `title_ar`, `description_ar`, `discount_type` (percentage/fixed), `discount_value`, `max_claims` (العدد المحدود), `claimed_count`, `is_active`, `valid_until`, `created_at`

**جدول `assistance_coupon_claims`** - تسجيل من حصّل الكوبون:
- `id`, `coupon_id` (FK), `user_id`, `coupon_code` (كود فريد مولّد), `is_used`, `created_at`
- UNIQUE constraint على `(coupon_id, user_id)` لمنع التحصيل المتكرر

**جدول `assistance_gifts`** - هدايا منتجات تُضاف للسلة:
- `id`, `product_id` (FK to merchant_products), `title_ar`, `description_ar`, `image_url`, `max_claims`, `claimed_count`, `is_active`, `created_at`

**جدول `assistance_gift_claims`** - من حصّل الهدية:
- `id`, `gift_id` (FK), `user_id`, `is_redeemed` (هل تم إضافتها لطلب), `created_at`
- UNIQUE constraint على `(gift_id, user_id)`

**جدول `assistance_red_envelopes`** - الظروف الحمراء:
- `id`, `title_ar`, `description_ar`, `spend_threshold` (مبلغ الإنفاق المطلوب مثلاً 50000), `discount_amount` (مبلغ الخصم مثلاً 5000), `max_discount` (الحد الأعلى مثلاً 15000), `max_claims`, `claimed_count`, `is_limited`, `is_active`, `created_at`

**جدول `assistance_envelope_claims`** - تحصيل الظروف:
- `id`, `envelope_id` (FK), `user_id`, `remaining_discount` (المبلغ المتبقي), `created_at`
- UNIQUE constraint على `(envelope_id, user_id)`

RLS: جميع الجداول تتطلب `authenticated` للقراءة، والـ claims تتطلب `auth.uid() = user_id` للإدخال.

#### 2. تعديل واجهة الصفحة الرئيسية

**إعادة بناء `MerchantGiveaways.tsx` → صفحة "المساعدات":**
- تغيير العنوان من "هدايا التجار" إلى "المساعدات"
- إضافة 4 تبويبات أفقية: **مسابقات** | **هدايا** | **كوبونات** | **ظروف حمراء**
- كل تبويب يعرض محتواه الخاص

#### 3. محتوى كل تبويب

**تبويب المسابقات:**
- ربط بنظام المسابقات الموجود (جدول `competitions`)
- عرض المسابقات النشطة والمنتهية مع اسم الفائز
- واجهة مبسطة عن صفحة المسابقات الكاملة

**تبويب الهدايا:**
- عرض منتجات من `assistance_gifts`
- زر "أضف الهدية للطلب التالي" → يسجل claim → تظهر في السلة تلقائياً عند الطلب
- شريط صغير في السلة بعنوان "هدية" عند وجود هدية محصّلة

**تبويب الكوبونات:**
- عرض كوبونات محدودة من `assistance_coupons`
- عرض العدد المتبقي وشريط تقدم
- زر "تحصيل" → إنشاء كوبون فريد في `assistance_coupon_claims`
- الكوبون يظهر في "كوبوناتي" بالملف الشخصي
- يُطبّق تلقائياً مع عرض قيمته وخيار التفعيل في المحفظة

**تبويب الظروف الحمراء:**
- عرض الظروف المتاحة مع شرح آلية العمل
- زر "احصل على الظرف"
- آلية: كل X دينار منفق يعطي Y خصم بحد أعلى Z
- مثال: كل 50,000 د.ع → خصم 5,000 بحد أعلى 15,000

#### 4. تكامل مع السلة

**تعديل `useCart.tsx`:**
- عند إضافة منتج للسلة، فحص `assistance_gift_claims` للمستخدم
- إذا وجدت هدية غير مستخدمة، إضافتها تلقائياً كعنصر مجاني
- عرض قسم "هدية 🎁" في واجهة السلة

#### 5. زر الوصول من المجتمع

**تعديل `CommunityGiftsButton.tsx`:**
- تغيير نص "هدايا التجار" إلى "المساعدات"
- التأكد من ظهور الزر بشكل واضح

**تعديل `CommunitySection.tsx`:**
- إضافة زر/بانر واضح للدخول لصفحة المساعدات في صفحة المجتمع الرئيسية

#### 6. تحديث الملفات

| ملف | تعديل |
|-----|--------|
| `src/pages/MerchantGiveaways.tsx` | إعادة بناء كاملة بنظام التبويبات الأربعة |
| `src/components/community/CommunityGiftsButton.tsx` | تغيير "هدايا التجار" → "المساعدات" |
| `src/components/community/CommunitySection.tsx` | إضافة بانر/زر وصول للمساعدات |
| `src/hooks/useCart.tsx` | إضافة فحص الهدايا المحصّلة |
| `src/pages/CommunityCart.tsx` | إضافة قسم "هدية" في واجهة السلة |
| `src/components/profile/CouponsStrip.tsx` | عرض كوبونات المساعدات المحصّلة |
| 4 مكونات فرعية جديدة | `AssistanceCompetitions`, `AssistanceGifts`, `AssistanceCoupons`, `AssistanceEnvelopes` |
| Migration SQL | إنشاء 6 جداول + RLS policies |

