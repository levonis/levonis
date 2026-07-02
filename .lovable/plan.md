# الخطة

## 1) إعادة لون الأيقونات للزيتوني (Primary Gold)

المشكلة: كثير من الأيقونات تستخدم `text-foreground` أو اللون الافتراضي (currentColor موروث من نص أسود) فتظهر سوداء بدلاً من الذهبي/الزيتوني للعلامة.

- الحل بدون كسر الحيادية:
  - إضافة قاعدة Tailwind ذكية في `src/index.css` تجعل الأيقونات ذات دور دلالي (رأس البطاقة، الشارات، أزرار الأيقونة، أيقونة الحقل، AdminCard/AdminStatCard icon) ترث `hsl(var(--primary))`.
  - تعديل `AdminLayout` (AdminCard/AdminStatCard/AdminEmptyState) لتمرير `text-primary` افتراضياً على `icon` prop.
  - تعديل عناصر التنقل والـHeaders (AppNavBar، PageHeader، Dialog Titles، Card Titles) لاستخدام `text-primary` بدل `text-foreground` عندما تكون الأيقونة زخرفية.
  - استثناء واضح: أيقونات تحمل لوناً برامجياً (Telegram `#0088cc`، حالة نجاح/تحذير/خطر) تبقى كما هي.

## 2) Skeleton مطابقة للمحتوى الفعلي

بدلاً من الشيمر العام، سنبني skeletons "route-aware" مطابقة تماماً للتخطيط النهائي (نفس الأبعاد، الفواصل، الشبكات) لتجنّب أي Layout Shift.

- إنشاء `src/components/skeletons/` يحتوي على skeleton مخصّص لكل صفحة رئيسية:
  - `HomeSkeleton` — Hero + Banners + Sections grid.
  - `SearchResultsSkeleton` — نفس شبكة SearchResults (2/3/4/5 أعمدة حسب breakpoint) + 18 بطاقة.
  - `ProductShopSkeleton` — نفس بطاقة ProductShop.
  - `ProductDetailsSkeleton` — صورة + سعر + خيارات + أزرار.
  - `CartSkeleton` — قائمة عناصر + ملخّص.
  - `AdminTableSkeleton` — رأس + صفوف جدول مطابقة لأعمدة الصفحة.
  - `RewardsHubSkeleton`, `NotificationsSkeleton`, `ProfileSkeleton`.
- استبدال `RouteAwareSkeleton` الحالي ليختار skeleton الصحيح حسب `pathname`.
- إبقاء جميع البطاقات تستخدم `Skeleton` من shadcn (glass-shimmer الحالي) لتحافظ على الهوية.
- الفائدة: صفر Layout Shift + إحساس تحميل حقيقي.

## 3) كوبون توصيل مجاني في إدارة الكوبونات

### تعديلات قاعدة البيانات (migration)
- توسيع CHECK على `coupons.discount_type` ليشمل قيمة جديدة: `free_shipping`.
- إضافة أعمدة:
  - `applicable_delivery_method text` (nullable، مفتاح مثل `standard` / `express` / `personal` / `pickup` — nullable يعني "أي نوع").
- تعديل RPC `validate_coupon_with_rate_limit` ليعيد الحقلين الجديدين ضمن الاستجابة.

### تعديلات AdminCoupons UI
- إضافة الخيار "توصيل مجاني" في `discount_type` Select.
- عند اختياره:
  - يختفي حقل `discount_value` (أو يُضبط تلقائياً على 0).
  - يظهر Select إلزامي لنوع التوصيل يقرأ من جدول `delivery_methods` (يشمل خيار "أي نوع" اختياري بحسب رغبتك — سنعتمد إلزامي مثلما طلبت).
  - يبقى `min_purchase_amount`, `max_uses`, `expires_at` كما هي.
- في الجدول: بادج جديد أخضر "توصيل مجاني — [اسم النوع]".

### تعديلات Cart
- عند تطبيق كوبون بنوع `free_shipping`:
  - إن كان `selectedDeliveryMethod !== coupon.applicable_delivery_method`: رفض مع toast:
    `الكوبون صالح فقط لنوع التوصيل: [اسم النوع]`.
  - إن تطابق: يُصفَّر رسم التوصيل ويظهر سطر في الملخّص "توصيل مجاني (كوبون)".
- عند تغيير المستخدم نوع التوصيل بعد التطبيق: إعادة تحقق تلقائي؛ إن لم يعد مطابقاً يُزال الكوبون تلقائياً مع toast تنبيه.
- عند تجاوز `min_purchase_amount` نزولاً: تحقق موجود، سنكرّره للنوع الجديد.

## تفاصيل تقنية

```sql
-- migration
ALTER TABLE public.coupons
  DROP CONSTRAINT coupons_discount_type_check,
  ADD CONSTRAINT coupons_discount_type_check
    CHECK (discount_type IN ('percentage','fixed','free_shipping'));

ALTER TABLE public.coupons
  ADD COLUMN applicable_delivery_method text;

-- تحديث الـ RPC ليُرجع applicable_delivery_method
CREATE OR REPLACE FUNCTION public.validate_coupon_with_rate_limit(...) ...
-- تُضاف: 'applicable_delivery_method', coupon_record.applicable_delivery_method
```

### ملفات ستُعدَّل
- `src/index.css` (قاعدة لون الأيقونات)
- `src/components/admin/AdminLayout.tsx` (icon prop → text-primary)
- `src/components/skeletons/*` (جديد)
- `src/components/RouteAwareSkeleton.tsx` (توجيه)
- `src/pages/AdminCoupons.tsx` (نوع free_shipping + delivery method Select + بادج)
- `src/pages/Cart.tsx` (منطق التطبيق والرفض/الإزالة التلقائية)
- Migration جديد للكوبون

## نطاق مقصود بعدم اللمس
- ألوان أيقونات ذات معنى (Telegram, warning, success, danger).
- أنواع الكوبونات الحالية (percentage/fixed) تبقى كما هي 100%.
- Phase 4/5 السابقة (Infinite Scroll، Realtime consolidation) لا تُمس.
