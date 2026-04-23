

# Dynamic Island - شريط علوي عائم موحّد

استبدال الشريط العلوي + شريط البحث + شريط الإعلانات + أزرار الرجوع وعناوين الصفحات بـ **جزيرة عائمة ديناميكية** (Dynamic Island) واحدة تتغيّر حسب الصفحة.

## السلوك حسب الحالة

| الحالة | الشكل | المحتوى |
|---|---|---|
| `promo` (الرئيسية، أعلى الصفحة) | كبسولة 260×40 | Marquee متحرك يعرض رسائل من جدول `announcements` |
| `search` (الرئيسية بعد التمرير + Products) | كبسولة 320×48 | حقل بحث "Search products…" + اختصار ⌘K |
| `category` (`/category/:slug`) | كبسولة 320×52 | زر رجوع ◀ + اسم القسم + زر بحث 🔍 |
| `product` (`/product/:slug`) | كبسولة 220×46 | زر رجوع ◀ + اسم المنتج |

تتنقل الحالات بانتقال spring سلس عبر `framer-motion` (التغيير بين الأشكال + fade للمحتوى).

## التغييرات

### 1) ملفات جديدة
- **`src/island/IslandContext.tsx`** — Provider يشتق الحالة تلقائياً من المسار الحالي + scroll position، ويتيح override يدوي عبر `setContext({ state, title })` لتمرير اسم القسم/المنتج.
- **`src/island/DynamicIsland.tsx`** — مكوّن الجزيرة بحدّ ذاته (animations + 4 حالات). سيتم تعريبه: استخدام `useLanguage()` لترجمة "Search products…" / placeholders بدلاً من النصوص الإنجليزية الثابتة، مع دعم RTL لأيقونة السهم (تقلب تلقائياً حسب `isRtl`).
- **`src/island/usePageTitle.ts`** (مساعد صغير) — hook يستدعي `setContext` عند mount/unmount لتمرير عنوان الصفحة (يُستخدم في `CategoryDetail` و `ProductDetail`).

### 2) `src/index.css`
إضافة توكنات `--island-bg` و `--gradient-island-stroke` و `--shadow-island` + كلاس `.island-surface` (glassmorphism + حدّ متدرج + لمعة علوية) + keyframes `marquee`. التوكنات تستعمل HSL متوافقة مع نظام الثيم الثلاثي الموجود.

### 3) `src/App.tsx`
- إضافة `<IslandProvider>` داخل `<BrowserRouter>` (بعد `LanguageProvider`).
- إضافة `<DynamicIsland />` كأول عنصر داخل `<AppContent>`.
- **حذف** `<AnnouncementBar />` و كل منطق `announcementHeight` / `verificationBannerHeight` المرتبط بالشريط القديم.

### 4) ربط رسائل الإعلانات الجديدة
داخل `IslandContext` (أو hook منفصل `useAnnouncements`):
- استعلام `useQuery` على جدول `announcements` (`active=true`) — نفس الاستعلام الموجود حالياً في `AnnouncementBar.tsx`.
- تمرير المصفوفة (`message_ar` / `message_en` / `message_ku` حسب اللغة) إلى `DynamicIsland` لتحلّ محل `promoMessages` الثابتة.
- يبقى الأدمن يحرّر نفس الجدول من `/admin/announcements` بدون أي تغيير في لوحة التحكم.

### 5) حذف الشيفرة القديمة

| ملف | إجراء |
|---|---|
| `src/components/SearchBar.tsx` | **حذف الملف** |
| `src/components/AnnouncementBar.tsx` | **حذف الملف** |
| `src/components/Header.tsx` | **حذف الملف** (غير مُستخدم فعلياً في App.tsx) |
| `src/components/TopBar.tsx` | **حذف الملف** — أزراره (السلة، الحساب، الإشعارات، اللغة، المحفظة، الإدارة...) موجودة أصلاً في `AppNavBar.tsx` السفلي |
| `src/pages/Home.tsx` | حذف `import SearchBar` و `<SearchBar />` (سطر 5 و 153) — البحث صار في الجزيرة |
| `src/pages/Products.tsx` | حذف `import SearchBar` و `<SearchBar />` (سطر 6 و 171) |
| `src/pages/PrinterProtection.tsx` | حذف `import Header` و `<Header />` |
| `src/pages/ProductsWithGifts.tsx` | حذف `import Header` و `<Header />` |
| `src/pages/CategoryDetail.tsx` | حذف زر "العودة" (الأسطر ≈357-371) — صار في الجزيرة. إضافة `usePageTitle({ state:'category', title: categoryName })` |
| `src/pages/ProductDetail.tsx` | حذف زرّي الرجوع (سطر 753-758 موبايل، 832-837 ديسكتوب) — صار في الجزيرة. إضافة `usePageTitle({ state:'product', title: product.name_ar })` |

### 6) ملاحظات تقنية
- `framer-motion` و `lucide-react` و `react-router-dom` مثبتة مسبقاً (لا حاجة للتثبيت).
- الجزيرة `position: fixed; top: 12px; z-50` — تُضاف padding-top على `<main>` (≈64px) لتعويض المساحة.
- شريط `AppNavBar` السفلي يبقى كما هو (بدون تغيير) — يحتفظ بالسلة/الحساب/الرسائل... إلخ.
- اسم المنتج/القسم يُمرّر باللغة النشطة عبر `pickName(name, name_ar)` المستعمل أصلاً.
- زر البحث داخل حالة `category` وحقل البحث في حالة `search` يفتحان شيت بحث (`/products?search=`) بنفس منطق `SearchBar` السابق.

### 7) أثر على i18n
إضافة 3 مفاتيح فقط في `types.ts` و `ar.ts` / `en.ts` / `ku.ts`:
- `island_search_placeholder` — "ابحث عن المنتجات…"
- `island_back` — "رجوع"
- `island_category_default` / `island_product_default` (اختياري كـ fallback)

