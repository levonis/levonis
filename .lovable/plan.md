

## إصلاح مشاكل البحث + إظهار الأسماء كاملة في الجزيرة

### 1) مشاكل البحث الحالية

**أ. الضغط على أيقونة البحث داخل قسم يخرج للرئيسية**
في `src/island/DynamicIsland.tsx` → الدالة `goSearch` تتحقق فقط من `state === "search"` لتركز على الـinput. لكن داخل `/category/:slug` الجزيرة في حالة `search` افتراضياً، فينجح هذا. **المشكلة الحقيقية**: عند تسجيل المستخدم العنوان بـ`setContext({ state: "category", title })` فإن `state` يصبح `"category"` لا `"search"`، فينفذ `navigate("/category/${slug}?focus=search")` بـ `replace: true` — وفي الواقع `params.slug` موجود فيعمل، لكن لا يوجد أي معالج لـ `?focus=search` فلا يحدث شيء مرئي. الحل: في حالة `category`/`product` نقوم بـ:
- إذا كنا داخل قسم → تبديل `state` للجزيرة لـ `search` فوراً عبر `setContext({ state: "search" })` و focus على الـinput.
- لا navigate، لا redirect.

**ب. كتابة كلمة في البحث لا يحدث شيء**
- داخل القسم: `useIslandSearch` يطلب من Supabase ويعرض النتائج، لكن الضغط على "View all" ينتقل لـ `/category/${slug}?q=...` — صحيح، و `CategoryDetail.tsx` يقرأ `?q=` ويفلتر. هذا يعمل.
- على الرئيسية: `goSearchUrl` يذهب لـ `/?q=...` لكن **`Home.tsx` لا يقرأ الـquery param إطلاقاً** فلا يحصل أي فلترة. هذه هي المشكلة.

**الحل**:
- في `src/pages/Home.tsx` أضف قراءة `?q=` عبر `useSearchParams`، ومرّره كـفلتر على شبكة المنتجات/البحث، مع شريط "نتائج البحث عن: «X» — مسح" أعلى الصفحة.
- إصلاح `goSearch` في `DynamicIsland.tsx` ليفتح الـinput مباشرة بدل التنقل (للحالات `category`/`product`/أي حالة).
- إصلاح فحص النص داخل القسم: في `useIslandSearch` يعمل عند `>= 2` حروف — جيد، لكن نضيف إشعاراً مرئياً عند 1 حرف فقط ("اكتب حرفين على الأقل") بدل أن تظل اللوحة فارغة.
- التأكد أن RLS على `products` يسمح بالقراءة العامة (موجود بالفعل في المشروع).

**ج. الأمور الإضافية**
- تنظيف query param بعد الضغط Enter يمسح `?q=` من URL — نتركه ليرى المستخدم النتائج.
- `submitSearch` يستدعي `resetSearch()` التي تـ blur الـinput — جيد، لكن نتركه يستدعي `goSearchUrl` بعدها.

### 2) إظهار الاسم كاملاً في الجزيرة (عربي/كردي/إنكليزي)

**المشكلة الحالية في `baseShape` (DynamicIsland.tsx)**:
```ts
const titleWidth = Math.min(220, Math.max(60, titleLen * 9));
```
- السقف 220px ثابت → الأسماء الطويلة تُقص.
- 9px/حرف غير دقيق للعربي والكردي (الحروف أعرض بسبب الـligatures والـdiacritics).
- الأنيميشن `scaleX: 0.6 → 1` يمطّ الحروف بصرياً مما يبدو مشوهاً.

**الإصلاحات**:

**أ. حساب عرض ذكي حسب اللغة**:
```ts
const perChar = (language === "ar" || language === "ku") ? 11 : 8.5;
const minBudget = 120;
const viewportBudget = typeof window !== "undefined" ? window.innerWidth - 48 : 520;
const desktopCap = 560;
const cap = Math.min(viewportBudget, desktopCap);
const titleWidth = Math.min(cap, Math.max(minBudget, titleLen * perChar + 24));
```
- يطبَّق على كلٍ من `category` و `product`.
- المسافة الأفقية للأزرار (back + search) ~96px تُترك كما هي، فيكون عرض الجزيرة الكلي = `titleWidth + chrome`.

**ب. إزالة scaleX من النص (كي لا يتمطط)**:
- داخل بلوك `category` و `product` في `motion.span`:
  - استبدال `scaleX: 0.6 → 1` بـ `opacity + y: 4 → 0` فقط.
  - الحاوية (الـshell) هي التي تتمدد عبر spring على `width`، فتظهر الحروف بحجمها الطبيعي.

**ج. اتجاه النص التلقائي للنصوص المختلطة**:
- إضافة `dir="auto"` على `<motion.span>` و `style={{ unicodeBidi: "plaintext" }}`.
- ينفع الأسماء المختلطة مثل "Bambulab X1 برو" أو "كرت RTX 4090".

**د. نعومة الـmorph عند التوسع لأسماء طويلة**:
- تخفيف spring الـwidth: `stiffness 360 → 300`, `damping 36 → 32` ليبدو الانفتاح متدفقاً وليس قافزاً.

### الملفات التي ستتغير
- `src/island/DynamicIsland.tsx` — `baseShape` (عرض ذكي)، `goSearch` (تبديل لـ search state بدل التنقل)، نص العنوان في `category`/`product` (إزالة scaleX، dir="auto")، تخفيف spring العرض.
- `src/pages/Home.tsx` — قراءة `?q=` وفلترة المنتجات + شريط مسح.
- ملاحظة: `CategoryDetail.tsx` يقرأ `?q=` بالفعل ويعمل، لا حاجة لتعديل.

### خارج النطاق
- لا تغييرات على RLS، لا migrations.
- لا تغييرات على debounce العنوان (يعمل من الجلسات السابقة).

