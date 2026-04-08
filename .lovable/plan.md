

## إضافة Skeleton Loading لجميع الصفحات

### النطاق
يوجد **59 صفحة** تستخدم حالياً `Loader2` spinner بدلاً من Skeleton loading. سيتم تحويلها جميعاً لاستخدام Skeleton components مناسبة لمحتوى كل صفحة.

### الاستراتيجية

**إنشاء مكونات Skeleton قابلة لإعادة الاستخدام** في ملف مركزي جديد، ثم استبدال كل spinner في كل صفحة.

#### 1. إنشاء `src/components/ui/PageSkeletons.tsx`
مكونات Skeleton عامة قابلة لإعادة الاستخدام:
- `HeaderSkeleton` — عنوان + وصف
- `GridCardsSkeleton` — شبكة بطاقات (2-4 أعمدة)
- `ListCardsSkeleton` — قائمة بطاقات عمودية
- `TableSkeleton` — جدول بيانات (للصفحات الإدارية)
- `FormSkeleton` — نموذج إعدادات
- `ChatSkeleton` — واجهة محادثة
- `DetailPageSkeleton` — صفحة تفاصيل منتج/طلب
- `StatsGridSkeleton` — شبكة إحصائيات
- `NotificationsSkeleton` — قائمة إشعارات
- `ProductGridSkeleton` — شبكة منتجات

#### 2. تحديث الصفحات العامة (الأولوية العالية — 20 صفحة)
الصفحات التي يراها المستخدم العادي:
- `Home.tsx` — skeleton للبانر + الأقسام + المنتجات
- `Categories.tsx` — شبكة skeleton للفئات
- `Products.tsx`, `ProductShop.tsx` — شبكة منتجات
- `Cart.tsx` — قائمة عناصر السلة
- `Competitions.tsx`, `CompetitionHistory.tsx` — بطاقات مسابقات
- `Notifications.tsx`, `NotificationSettings.tsx` — قائمة إشعارات
- `ProfileSettings.tsx`, `UserInfo.tsx` — نماذج إعدادات
- `MyOrders.tsx`, `OrderDetail.tsx` — قائمة/تفاصيل طلبات
- `BundleDetail.tsx`, `ProductBundles.tsx` — حزم المنتجات
- `ProductOffersPage.tsx`, `OffersStoragePage.tsx` — عروض
- `MyCustomRequests.tsx`, `MyOfferPurchases.tsx`, `MyPurchasedProducts.tsx`
- `PublicProfile.tsx`, `ReelsPage.tsx`, `WarrantyDashboard.tsx`

#### 3. تحديث صفحات المجتمع (8 صفحات)
- `CommunityMessages.tsx` — ChatSkeleton
- `ChatOrderCheckout.tsx` — FormSkeleton

#### 4. تحديث الصفحات الإدارية (31 صفحة)
جميع صفحات `Admin*.tsx` — استخدام `TableSkeleton` أو `ListCardsSkeleton` حسب المحتوى

### التنفيذ لكل صفحة
1. استيراد Skeleton المناسب من `PageSkeletons.tsx`
2. استبدال `<Loader2 className="animate-spin" />` بمكون Skeleton مطابق لتخطيط الصفحة
3. إزالة استيراد `Loader2` إذا لم يعد مستخدماً في مكان آخر

### الملفات المتأثرة
- **ملف جديد**: `src/components/ui/PageSkeletons.tsx`
- **59 صفحة**: جميع الصفحات المذكورة أعلاه في `src/pages/`

