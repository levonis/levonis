

The user says skeleton loading is inaccurate — appears randomly and doesn't match the actual content shape. Let me check the current skeleton system.
<lov-tool-use id="toolu_vrtx_01MfqUxoEHiKaKEsArGSsQWr" name="code--search_files" integration-id="code" data="{\"query\": \"RouteAwareSkeleton\", \"include_patterns\": \"*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KUw6iLjgDnn1FLZAGjjhP8" name="code--search_files" integration-id="code" data="{\"query\": \"RouteAwareSkeleton\", \"include_patterns\": \"*.tsx,*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018AJDjEoz8ZpbMw4Ub2Qoqi" name="code--search_files" integration-id="code" data="{\"query\": \"Skeleton\", \"include_patterns\": \"src/App.tsx,src/components/RouteAware*,src/components/skeleton*\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01HPpDwJN2veMAThNRzZafhD" name="code--search_files" integration-id="code" data="{\"query\": \"Suspense fallback\", \"include_patterns\": \"src/App.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EdCc7zdj5QX9prcqYVx9qi" name="code--view" integration-id="code" data="{\"file_path\": \"src/App.tsx\", \"lines\": \"138-200\"}">
</lov-tool-use>
Now I understand. The single generic `SuspenseLoader` shows the same skeleton (header + image card + 4 grid tiles) for every route — cart, profile, admin pages, settings, etc. — so it rarely matches the actual content layout, looking "random/inaccurate." Let me check existing route-specific skeletons.
<lov-tool-use id="toolu_vrtx_011DVtX4EHqpSodabmHFnZhP" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/components/**/*.tsx\", \"query\": \"export.*Skeleton\"}">
</lov-tool-use>
I have enough context. The skeleton library already exists with route-appropriate variants — they're just not wired into the route-level Suspense fallback.

<lov-plan>

## المشكلة
كل الصفحات (~120) تعرض **نفس الـ skeleton الافتراضي** (هيدر + صورة كبيرة + 4 بطاقات شبكة) من `SuspenseLoader` في `src/App.tsx`. النتيجة: عند فتح صفحة السلة، الإعدادات، الإشعارات، أو لوحة الأدمن → يظهر skeleton لمنتجات لا علاقة له بالمحتوى الفعلي → يبدو "عشوائياً".

## الحل: Skeleton حسب نوع الصفحة (Route-Aware)

### الفكرة
نستفيد من مكتبة `PageSkeletons.tsx` الموجودة بالفعل (بها `CartSkeleton`, `ProfileSkeleton`, `ChatSkeleton`, `AdminPageSkeleton`, `DetailPageSkeleton`, `OrderListSkeleton`, `FormSkeleton`, `NotificationsSkeleton`, `ProductGridSkeleton`...) ونربط كل مسار بالـ skeleton المناسب.

### التنفيذ في `src/App.tsx`

**1. تحويل `SuspenseLoader` ليقرأ المسار الحالي**
بما أنه داخل `AppContent` (الذي يستخدم `useLocation` مسبقاً)، سنمرر `pathname` للـ fallback ليختار الشكل المناسب:

```tsx
const RouteSkeleton = ({ pathname }: { pathname: string }) => {
  // Map: cart→CartSkeleton, /orders→OrderListSkeleton,
  // /notifications→NotificationsSkeleton, /admin/*→AdminPageSkeleton,
  // /profile|/user-info→ProfileSkeleton, /chat|/messages→ChatSkeleton,
  // /product/:slug→DetailPageSkeleton, /products|/category/*→ProductGridSkeleton,
  // /settings|/notification-settings→FormSkeleton,
  // default→الشكل الحالي البسيط
};
```

**2. خريطة المسارات** (~15 نمط) تغطي:
- `/cart` → `CartSkeleton`
- `/orders`, `/my-orders` → `OrderListSkeleton`
- `/notifications` → `NotificationsSkeleton`
- `/notification-settings`, `/settings`, `/user-info` → `FormSkeleton`
- `/profile/*`, `/profile-settings` → `ProfileSkeleton`
- `/chat`, `/messages`, `/maintenance-chat` → `ChatSkeleton`
- `/product/:slug`, `/bundles/:id`, `/category/:slug` → `DetailPageSkeleton`
- `/products`, `/shop`, `/favorites`, `/offers` → `ProductGridSkeleton`
- `/admin/*`, `/inventory`, `/financial-*`, `/games-settings` → `AdminPageSkeleton`
- `/rewards`, `/competitions` → `CompetitionGridSkeleton`
- `/download-app` → skeleton مخصص بسيط (زر كبير + نص)
- باقي المسارات → الشكل العام الحالي

**3. منع وميض غير ضروري**: عرض الـ skeleton فقط بعد 80ms (delay) باستخدام state مع `setTimeout` — إذا حُمّلت الصفحة من الكاش بسرعة، لن يظهر أي skeleton أصلاً.

### الملفات المعدّلة
- `src/App.tsx` فقط — حوالي 40 سطر يستبدل `SuspenseLoader` بمكون `RouteSkeleton` ذكي يقرأ `useLocation` ويختار من `PageSkeletons`.

### النتيجة المتوقعة
- صفحة السلة → skeleton على شكل عناصر سلة
- صفحة الإشعارات → skeleton على شكل قائمة إشعارات
- صفحة منتج → skeleton على شكل صفحة تفاصيل
- لوحة الأدمن → skeleton على شكل إحصائيات + جدول
- الانتقالات السريعة (<80ms) → بدون أي skeleton (تجربة فورية)

