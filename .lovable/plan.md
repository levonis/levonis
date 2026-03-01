

## المشكلة

الشريط العلوي (TopBar/Header) تم حذفه من `AppContent` لكنه لا يزال مستورداً، والأهم أن **31 صفحة** لا تزال تحتوي على `pt-20` أو `pt-24` أو `pt-28` كحشوة علوية كانت مخصصة لتعويض ارتفاع الشريط العلوي الثابت. هذا يسبب مساحة فارغة في أعلى كل صفحة.

بالإضافة لذلك، `AdminLayout.tsx` يحتوي على `sticky top-16` الذي كان يضع الهيدر أسفل الشريط العلوي.

## الخطة

### 1. تنظيف الاستيرادات في App.tsx
- إزالة استيراد `Header` من `AppContent` (غير مستخدم)

### 2. تعديل الحشوة العلوية في جميع الصفحات (31 ملف)
استبدال `pt-20` / `pt-24` / `pt-28` بقيمة مناسبة (`pt-6` أو `pt-8`) في كل الصفحات التالية:

| الملف | التغيير |
|-------|---------|
| `Home.tsx` | `pt-20` → `pt-6` |
| `Cart.tsx` | `pt-24` → `pt-6` (موقعين) |
| `Categories.tsx` | `pt-28` → `pt-8` |
| `CategoryDetail.tsx` | `pt-24` → `pt-6` |
| `CommunityHome.tsx` | `pt-20` → `pt-6` |
| `Products.tsx` | `pt-24` → `pt-6` |
| `ProductDetail.tsx` | `pt-24` → `pt-6` |
| `OrderDetail.tsx` | `pt-20` → `pt-6` |
| `Favorites.tsx` | `pt-24` أو مشابه → `pt-6` |
| `MyOrders.tsx` | → `pt-6` |
| `UserInfo.tsx` | → `pt-6` |
| `Wishes.tsx` | `pt-20` → `pt-6` |
| `Admin.tsx` | `pt-24` → `pt-6` |
| `AdminWishes.tsx` | `pt-20` → `pt-6` |
| `CommunityMerchantDashboard.tsx` | `pt-24` → `pt-6` (3 مواقع) |
| `CommunityMerchantOrders.tsx` | `pt-24`/`pt-20` → `pt-6` (3 مواقع) |
| `CommunityCustomerRequests.tsx` | `pt-20` → `pt-6` |
| `CommunityRequestsBrowse.tsx` | `pt-20` → `pt-6` |
| `CommunityCustomerTrack.tsx` | `pt-24` → `pt-6` |
| وباقي الصفحات... | نفس المبدأ |

### 3. تعديل AdminLayout.tsx
- تغيير `sticky top-16` إلى `sticky top-0` لأن الشريط العلوي لم يعد موجوداً

### 4. تعديل المكونات الفرعية
- `ProfessionalMerchantDashboard.tsx` يحتوي على `pt-24` → `pt-6`

### التفاصيل التقنية
- جميع التغييرات هي استبدال CSS classes فقط (لا تغيير في المنطق)
- القيمة المستبدلة `pt-6` (24px) أو `pt-8` (32px) تعطي مسافة طبيعية بدون الفراغ الكبير
- الصفحات التي تستخدم `AdminLayout` لا تحتاج تعديل فردي (ستتعدل تلقائياً)

